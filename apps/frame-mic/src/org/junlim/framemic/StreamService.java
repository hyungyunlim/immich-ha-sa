package org.junlim.framemic;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaRecorder;
import android.os.IBinder;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;
import org.webrtc.PeerConnection;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Serves the microphone as an endless 16 kHz mono WAV over HTTP, only while enabled and only while someone listens.
 *
 * All endpoints need ?k=KEY, where KEY is generated on first launch and shown in the app:
 *   GET /status    JSON state
 *   GET /enable    allow listening (persisted)
 *   GET /disable   stop any stream and refuse new ones (persisted, the default)
 *   GET /mic.wav   live 16 kHz mono WAV (lossless, for speech recognition)
 *   GET /mic.aac   live AAC-LC in ADTS (internet-radio format; players and speakers treat it as a live stream)
 *   GET /notify?on=1|0  show or hide who is listening in the Android notification (persisted, default on)
 *   POST /call     two-way WebRTC audio: body is an SDP offer with its ICE candidates, the response the answer;
 *                  an optional X-Ice-Servers header (base64 JSON, RTCIceServer[]) adds STUN/TURN servers
 *   GET /hangup    end the call
 *
 * A call and a stream both need the mic, so whichever starts last takes it over.
 *
 * ponytail: one listener at a time and the newest wins; add a fan-out when two people need to listen at once.
 */
public class StreamService extends Service {
    static final int PORT = 8765;
    static final String VERSION = "0.7";
    static final int RATE = 16000;
    private static final String CHANNEL = "mic";

    // Vendor HALs differ in which source delivers samples. On the Lenovo Smart Frame VOICE_RECOGNITION works
    // and VOICE_COMMUNICATION does not initialize; the last working one is remembered and tried first.
    private static final int[] SOURCES = {
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            MediaRecorder.AudioSource.MIC,
            MediaRecorder.AudioSource.CAMCORDER,
            MediaRecorder.AudioSource.UNPROCESSED,
            MediaRecorder.AudioSource.DEFAULT,
    };
    private static final String[] SOURCE_NAMES = {
            "VOICE_RECOGNITION", "VOICE_COMMUNICATION", "MIC", "CAMCORDER", "UNPROCESSED", "DEFAULT"};

    private final AtomicBoolean streaming = new AtomicBoolean();
    // Bumped by every new listener; a running stream ends when it no longer holds the latest value.
    private final AtomicInteger listener = new AtomicInteger();
    private volatile boolean running;
    private volatile ServerSocket server;
    private volatile String client = "";
    private volatile String detail = "idle";
    private SharedPreferences prefs;
    private Call call;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences("framemic", MODE_PRIVATE);
        call = new Call(this, new Runnable() {
            @Override
            public void run() {
                refreshNote();
            }
        });
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Mic stream", NotificationManager.IMPORTANCE_LOW));
        startForeground(1, note());
        if (!running) {
            running = true;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    serve();
                }
            }, "mic-http").start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        call.hangup();
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
        super.onDestroy();
    }

    private boolean enabled() {
        return prefs.getBoolean("enabled", false);
    }

    private void setEnabled(boolean on) {
        prefs.edit().putBoolean("enabled", on).apply();
        refreshNote();
    }

    private Notification note() {
        String text = !prefs.getBoolean("notify", true) ? "Running"
                : streaming.get() ? "Streaming to " + client
                : !"idle".equals(call.state()) ? "Call: " + call.state()
                : enabled() ? "On: mic opens only while someone listens" : "Off";
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("Frame Mic")
                .setContentText(text)
                .setOngoing(true)
                .build();
    }

    private void refreshNote() {
        getSystemService(NotificationManager.class).notify(1, note());
    }

    private void serve() {
        try (ServerSocket ss = new ServerSocket(PORT)) {
            server = ss;
            while (running) {
                final Socket s = ss.accept();
                // One thread per connection so /status and /disable answer while a stream is running
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try (Socket c = s) {
                            handle(c);
                        } catch (IOException | RuntimeException ignored) {
                            // listener went away or the mic failed
                        }
                    }
                }, "mic-conn").start();
            }
        } catch (IOException e) {
            running = false;
        }
    }

    private void handle(Socket s) throws IOException {
        s.setSoTimeout(5000);
        BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.US_ASCII));
        String request = in.readLine(); // e.g. "GET /mic.wav?k=KEY HTTP/1.1"
        OutputStream out = s.getOutputStream();
        if (request == null || !(request.startsWith("GET ") || request.startsWith("POST "))
                || !request.contains("k=" + key(this))) {
            respond(out, "403 Forbidden", "text/plain", "forbidden");
            return;
        }
        String target = request.split(" ")[1];
        String path = target.contains("?") ? target.substring(0, target.indexOf('?')) : target;
        if (path.equals("/status")) {
            respond(out, "200 OK", "application/json", json());
        } else if (path.equals("/enable")) {
            setEnabled(true);
            respond(out, "200 OK", "application/json", json());
        } else if (path.equals("/disable")) {
            setEnabled(false); // a running stream sees this within ~20 ms and ends
            call.hangup();
            respond(out, "200 OK", "application/json", json());
        } else if (path.equals("/notify")) {
            prefs.edit().putBoolean("notify", !target.contains("on=0")).apply();
            refreshNote();
            respond(out, "200 OK", "application/json", json());
        } else if (path.equals("/mic.wav")) {
            stream(s, out, false);
        } else if (path.equals("/mic.aac")) {
            stream(s, out, true);
        } else if (path.equals("/call") && request.startsWith("POST ")) {
            answerCall(in, out);
        } else if (path.equals("/hangup")) {
            call.hangup();
            respond(out, "200 OK", "application/json", json());
        } else {
            respond(out, "404 Not Found", "text/plain", "not found");
        }
    }

    private void answerCall(BufferedReader in, OutputStream out) throws IOException {
        int length = 0;
        List<PeerConnection.IceServer> iceServers = new ArrayList<>();
        for (String header; (header = in.readLine()) != null && !header.isEmpty(); ) {
            if (header.regionMatches(true, 0, "Content-Length:", 0, 15)) length = Integer.parseInt(header.substring(15).trim());
            if (header.regionMatches(true, 0, "X-Ice-Servers:", 0, 14)) iceServers = iceServers(header.substring(14).trim());
        }
        if (!enabled()) {
            respond(out, "423 Locked", "text/plain", "mic stream is off");
            return;
        }
        if (length <= 0 || length > 65536) {
            respond(out, "400 Bad Request", "text/plain", "send the SDP offer as the request body");
            return;
        }
        char[] body = new char[length]; // SDP is ASCII, so chars and bytes match
        for (int off = 0, n; off < length; off += n) {
            if ((n = in.read(body, off, length - off)) < 0) throw new IOException("offer cut short");
        }
        // Take the mic from a running stream, which notices within ~20 ms
        listener.incrementAndGet();
        long deadline = System.currentTimeMillis() + 2000;
        while (streaming.get() && System.currentTimeMillis() < deadline) sleep(20);
        String answer;
        try {
            answer = call.answer(new String(body), SOURCES[prefs.getInt("source", 0)], iceServers);
        } catch (Exception e) {
            respond(out, "500 Internal Server Error", "text/plain", "call failed: " + e);
            return;
        }
        byte[] b = answer.getBytes(StandardCharsets.US_ASCII); // exact SDP: its last line must keep its CRLF
        out.write(("HTTP/1.0 200 OK\r\nContent-Type: application/sdp\r\nContent-Length: " + b.length
                + "\r\nCache-Control: no-cache\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        out.write(b);
    }

    /** Decodes RTCIceServer[] JSON (base64); a bad header just means no STUN/TURN, never a failed call. */
    static List<PeerConnection.IceServer> iceServers(String base64) {
        List<PeerConnection.IceServer> servers = new ArrayList<>();
        try {
            JSONArray list = new JSONArray(new String(Base64.decode(base64, Base64.DEFAULT), StandardCharsets.UTF_8));
            for (int i = 0; i < list.length(); i++) {
                JSONObject server = list.getJSONObject(i);
                List<String> urls = new ArrayList<>();
                JSONArray many = server.optJSONArray("urls");
                if (many != null) {
                    for (int j = 0; j < many.length(); j++) urls.add(many.getString(j));
                } else {
                    urls.add(server.getString("urls"));
                }
                servers.add(PeerConnection.IceServer.builder(urls)
                        .setUsername(server.optString("username", ""))
                        .setPassword(server.optString("credential", ""))
                        .createIceServer());
            }
        } catch (Exception ignored) {
            servers.clear();
        }
        return servers;
    }

    private void stream(Socket s, OutputStream out, boolean aac) throws IOException {
        if (!enabled()) {
            respond(out, "423 Locked", "text/plain", "mic stream is off");
            return;
        }
        call.hangup(); // the newest user of the mic wins
        // The newest listener takes over the mic. Players such as nPlayer reconnect with Range requests
        // right after closing the first connection, before the old stream has noticed it is gone.
        int me = listener.incrementAndGet();
        long deadline = System.currentTimeMillis() + 2000;
        while (streaming.get() && listener.get() == me && System.currentTimeMillis() < deadline) {
            sleep(20);
        }
        if (listener.get() != me || !streaming.compareAndSet(false, true)) {
            respond(out, "409 Conflict", "text/plain", "superseded by a newer listener");
            return;
        }
        AudioRecord rec = null;
        AacEncoder encoder = null;
        try {
            byte[] buf = new byte[RATE * 2 / 10]; // 100 ms of 16-bit mono
            int[] first = new int[1];
            rec = openMic(buf, first);
            if (rec == null) {
                respond(out, "503 Service Unavailable", "text/plain", detail);
                return;
            }
            client = s.getInetAddress().getHostAddress();
            refreshNote();
            out.write(("HTTP/1.0 200 OK\r\nContent-Type: " + (aac ? "audio/aac" : "audio/wav")
                    + "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            if (aac) {
                encoder = new AacEncoder();
                encoder.write(buf, first[0], out);
            } else {
                out.write(wavHeader());
                out.write(buf, 0, first[0]);
            }
            long lastData = System.currentTimeMillis();
            while (running && enabled() && listener.get() == me) {
                int n = rec.read(buf, 0, buf.length, AudioRecord.READ_NON_BLOCKING);
                if (n > 0) {
                    // throws once the listener disconnects
                    if (encoder != null) encoder.write(buf, n, out);
                    else out.write(buf, 0, n);
                    lastData = System.currentTimeMillis();
                } else if (n < 0 || System.currentTimeMillis() - lastData > 3000) {
                    detail += " | stopped: read=" + n;
                    break;
                } else {
                    sleep(20);
                }
            }
        } finally {
            if (encoder != null) encoder.release();
            if (rec != null) {
                if (rec.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) rec.stop();
                rec.release();
            }
            client = "";
            streaming.set(false);
            refreshNote();
        }
    }

    /** Opens the first source that yields samples within ~1.5 s, preferring the last one that worked. */
    private AudioRecord openMic(byte[] buf, int[] first) {
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int preferred = prefs.getInt("source", 0);
        StringBuilder log = new StringBuilder();
        for (int k = 0; k < SOURCES.length; k++) {
            int i = (preferred + k) % SOURCES.length;
            AudioRecord rec;
            try {
                rec = new AudioRecord(SOURCES[i], RATE, AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT, Math.max(min, RATE * 2));
            } catch (RuntimeException e) {
                log.append(SOURCE_NAMES[i]).append(": ").append(e.getClass().getSimpleName()).append("; ");
                continue;
            }
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) {
                rec.release();
                log.append(SOURCE_NAMES[i]).append(": not initialized; ");
                continue;
            }
            rec.startRecording();
            int n = -100;
            if (rec.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                n = 0;
                long until = System.currentTimeMillis() + 1500;
                while (n == 0 && System.currentTimeMillis() < until) {
                    n = rec.read(buf, 0, buf.length, AudioRecord.READ_NON_BLOCKING);
                    if (n == 0) sleep(20);
                }
            }
            if (n > 0) {
                first[0] = n;
                prefs.edit().putInt("source", i).apply();
                detail = "streaming from " + SOURCE_NAMES[i] + (log.length() > 0 ? " (tried: " + log + ")" : "");
                return rec;
            }
            log.append(SOURCE_NAMES[i]).append(": read=").append(n).append("; ");
            if (rec.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) rec.stop();
            rec.release();
        }
        detail = "no working mic source: " + log;
        return null;
    }

    private String json() {
        return "{\"version\":\"" + VERSION + "\",\"enabled\":" + enabled() + ",\"notify\":" + prefs.getBoolean("notify", true)
                + ",\"streaming\":" + streaming.get() + ",\"call\":\"" + call.state() + "\""
                + ",\"client\":\"" + esc(client) + "\",\"source\":\"" + esc(SOURCE_NAMES[prefs.getInt("source", 0)])
                + "\",\"detail\":\"" + esc(detail) + "\"}";
    }

    private static String esc(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void respond(OutputStream out, String code, String type, String body) throws IOException {
        byte[] b = (body + "\n").getBytes(StandardCharsets.UTF_8);
        out.write(("HTTP/1.0 " + code + "\r\nContent-Type: " + type + "; charset=utf-8\r\nContent-Length: " + b.length
                + "\r\nCache-Control: no-cache\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        out.write(b);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
        }
    }

    /** Encodes 16 kHz mono PCM to AAC-LC and writes each frame with an ADTS header. */
    private static final class AacEncoder {
        private final MediaCodec codec;
        private final MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        private long ptsUs;

        AacEncoder() throws IOException {
            MediaFormat format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, RATE, 1);
            format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            format.setInteger(MediaFormat.KEY_BIT_RATE, 48000);
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, RATE * 2);
            codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            codec.start();
        }

        void write(byte[] pcm, int len, OutputStream out) throws IOException {
            int off = 0;
            while (off < len) {
                int in = codec.dequeueInputBuffer(10000);
                if (in < 0) break; // encoder backed up: drop this slice instead of stalling the mic
                ByteBuffer input = codec.getInputBuffer(in);
                input.clear();
                int n = Math.min(input.remaining(), len - off);
                input.put(pcm, off, n);
                codec.queueInputBuffer(in, 0, n, ptsUs, 0);
                ptsUs += n / 2 * 1000000L / RATE;
                off += n;
            }
            int index;
            while ((index = codec.dequeueOutputBuffer(info, 0)) >= 0) {
                if ((info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && info.size > 0) {
                    byte[] frame = new byte[info.size + 7];
                    adtsHeader(frame, frame.length);
                    ByteBuffer output = codec.getOutputBuffer(index);
                    output.position(info.offset);
                    output.get(frame, 7, info.size);
                    out.write(frame);
                }
                codec.releaseOutputBuffer(index, false);
            }
        }

        void release() {
            try {
                codec.stop();
            } catch (RuntimeException ignored) {
            }
            codec.release();
        }
    }

    /** 7-byte ADTS header: MPEG-4 AAC-LC, 16 kHz (index 8), mono, no CRC; len includes the header. */
    static void adtsHeader(byte[] p, int len) {
        final int profile = 2;
        final int freqIndex = 8;
        final int channels = 1;
        p[0] = (byte) 0xFF;
        p[1] = (byte) 0xF1;
        p[2] = (byte) (((profile - 1) << 6) + (freqIndex << 2) + (channels >> 2));
        p[3] = (byte) (((channels & 3) << 6) + (len >> 11));
        p[4] = (byte) ((len & 0x7FF) >> 3);
        p[5] = (byte) (((len & 7) << 5) + 0x1F);
        p[6] = (byte) 0xFC;
    }

    /** WAV header with a huge length so players treat the response as a live stream. */
    static byte[] wavHeader() {
        ByteBuffer b = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(0x7FFFFFFF);
        b.put("WAVE".getBytes(StandardCharsets.US_ASCII));
        b.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16);
        b.putShort((short) 1).putShort((short) 1).putInt(RATE).putInt(RATE * 2);
        b.putShort((short) 2).putShort((short) 16);
        b.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(0x7FFFFFFF - 36);
        return b.array();
    }

    /** Per-device key, generated once and kept in app storage (cleared by uninstalling). */
    static synchronized String key(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("framemic", MODE_PRIVATE);
        String key = prefs.getString("key", null);
        if (key == null) {
            byte[] bytes = new byte[8];
            new SecureRandom().nextBytes(bytes);
            StringBuilder hex = new StringBuilder();
            for (byte b : bytes) hex.append(String.format("%02x", b));
            key = hex.toString();
            prefs.edit().putString("key", key).apply();
        }
        return key;
    }

    static String url(Context context) {
        String ip = "<frame-ip>";
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!a.isLoopbackAddress() && a instanceof Inet4Address) ip = a.getHostAddress();
                }
            }
        } catch (Exception ignored) {
        }
        return "http://" + ip + ":" + PORT + "/mic.wav?k=" + key(context);
    }
}
