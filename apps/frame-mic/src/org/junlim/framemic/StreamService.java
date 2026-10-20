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
import android.media.MediaRecorder;
import android.os.IBinder;

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
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Serves the microphone as an endless 16 kHz mono WAV over HTTP, only while enabled and only while someone listens.
 *
 * All endpoints need ?k=KEY, where KEY is generated on first launch and shown in the app:
 *   GET /status    JSON state
 *   GET /enable    allow listening (persisted)
 *   GET /disable   stop any stream and refuse new ones (persisted, the default)
 *   GET /mic.wav   the live stream
 *
 * ponytail: one listener at a time; add a fan-out when two people need to listen at once.
 */
public class StreamService extends Service {
    static final int PORT = 8765;
    static final String VERSION = "0.3";
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
    private volatile boolean running;
    private volatile ServerSocket server;
    private volatile String client = "";
    private volatile String detail = "idle";
    private SharedPreferences prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences("framemic", MODE_PRIVATE);
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
        String text = streaming.get() ? "Streaming to " + client
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
        if (request == null || !request.startsWith("GET ") || !request.contains("k=" + key(this))) {
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
            respond(out, "200 OK", "application/json", json());
        } else if (path.equals("/mic.wav")) {
            stream(s, out);
        } else {
            respond(out, "404 Not Found", "text/plain", "not found");
        }
    }

    private void stream(Socket s, OutputStream out) throws IOException {
        if (!enabled()) {
            respond(out, "423 Locked", "text/plain", "mic stream is off");
            return;
        }
        if (!streaming.compareAndSet(false, true)) {
            respond(out, "409 Conflict", "text/plain", "already streaming to " + client);
            return;
        }
        AudioRecord rec = null;
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
            out.write("HTTP/1.0 200 OK\r\nContent-Type: audio/wav\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
                    .getBytes(StandardCharsets.US_ASCII));
            out.write(wavHeader());
            out.write(buf, 0, first[0]);
            long lastData = System.currentTimeMillis();
            while (running && enabled()) {
                int n = rec.read(buf, 0, buf.length, AudioRecord.READ_NON_BLOCKING);
                if (n > 0) {
                    out.write(buf, 0, n); // throws once the listener disconnects
                    lastData = System.currentTimeMillis();
                } else if (n < 0 || System.currentTimeMillis() - lastData > 3000) {
                    detail += " | stopped: read=" + n;
                    break;
                } else {
                    sleep(20);
                }
            }
        } finally {
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
        return "{\"version\":\"" + VERSION + "\",\"enabled\":" + enabled() + ",\"streaming\":" + streaming.get()
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
