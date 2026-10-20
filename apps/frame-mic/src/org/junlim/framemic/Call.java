package org.junlim.framemic;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.SpannableString;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.TextView;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.DataChannel;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.audio.AudioDeviceModule;
import org.webrtc.audio.JavaAudioDeviceModule;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Two-way WebRTC audio, answered automatically like an intercom. The caller POSTs an SDP offer that already
 * holds its ICE candidates and gets a complete answer back, so no signaling channel stays open.
 *
 * ponytail: one call at a time and the newest caller wins; no STUN/TURN, so callers must reach the frame
 * directly (home LAN or VPN). Add ICE servers here when calls from outside are needed.
 */
final class Call {
    private final Context context;
    private final Runnable changed;
    // Every PeerConnection call runs here: WebRTC callbacks must never block on, or dispose, their own thread.
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private PeerConnectionFactory factory;
    private PeerConnection pc;
    private AudioSource source;
    private volatile int generation; // ignores late callbacks from an earlier call
    private volatile String state = "idle";
    private TextView indicator;

    Call(Context context, Runnable changed) {
        this.context = context.getApplicationContext();
        this.changed = changed;
    }

    String state() {
        return state;
    }

    /** Hangs up any running call, answers the offer, and returns the answer SDP. */
    String answer(final String offer, final int audioSource) throws Exception {
        return worker.submit(new Callable<String>() {
            @Override
            public String call() throws Exception {
                return doAnswer(offer, audioSource);
            }
        }).get(15, TimeUnit.SECONDS);
    }

    void hangup() {
        try {
            worker.submit(new Runnable() {
                @Override
                public void run() {
                    close();
                }
            }).get(5, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        }
    }

    private String doAnswer(String offer, int audioSource) throws Exception {
        close();
        if (factory == null) factory = createFactory(audioSource);
        final int call = generation;
        final CountDownLatch gathered = new CountDownLatch(1);
        PeerConnection.RTCConfiguration config = new PeerConnection.RTCConfiguration(new ArrayList<PeerConnection.IceServer>());
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        pc = factory.createPeerConnection(config, new Events(call, gathered));
        if (pc == null) throw new IOException("could not create a peer connection");
        state = "connecting";
        new Sdp().set(pc, new SessionDescription(SessionDescription.Type.OFFER, offer), false);
        source = factory.createAudioSource(new MediaConstraints()); // echo cancellation, noise suppression and AGC are on by default
        AudioTrack track = factory.createAudioTrack("mic", source);
        pc.addTrack(track, Collections.singletonList("frame"));
        SessionDescription answer = new Sdp().create(pc);
        new Sdp().set(pc, answer, true);
        gathered.await(3, TimeUnit.SECONDS); // host candidates only, normally done in milliseconds
        return pc.getLocalDescription().description;
    }

    private void close() {
        generation++;
        if (pc != null) {
            pc.dispose(); // also stops the mic and the speaker
            pc = null;
        }
        if (source != null) {
            source.dispose();
            source = null;
        }
        state = "idle";
        showIndicator(false);
        changed.run();
    }

    private void closeIfCurrent(final int call) {
        worker.execute(new Runnable() {
            @Override
            public void run() {
                if (call == generation) close();
            }
        });
    }

    private PeerConnectionFactory createFactory(int audioSource) {
        PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions());
        // The frame has no hardware echo canceller for VOICE_RECOGNITION/MIC, so WebRTC's software one does the work.
        // Calls play at the media volume, the same one the slideshow and the Frame Speaker use.
        AudioDeviceModule adm = JavaAudioDeviceModule.builder(context)
                .setAudioSource(audioSource)
                .setInputSampleRate(StreamService.RATE)
                .setUseHardwareAcousticEchoCanceler(false)
                .setUseHardwareNoiseSuppressor(false)
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build())
                .createAudioDeviceModule();
        return PeerConnectionFactory.builder().setAudioDeviceModule(adm).createPeerConnectionFactory();
    }

    /** A small "on call" pill at the top center (clear of the kiosk clock and weather), drawn over FreeKiosk when "Display over other apps" is allowed. */
    private void showIndicator(final boolean show) {
        main.post(new Runnable() {
            @Override
            public void run() {
                WindowManager wm = context.getSystemService(WindowManager.class);
                if (show && indicator == null && Settings.canDrawOverlays(context)) {
                    SpannableString text = new SpannableString(
                            "● " + ("ko".equals(Locale.getDefault().getLanguage()) ? "통화 중" : "On call"));
                    text.setSpan(new ForegroundColorSpan(0xFFE5484D), 0, 1, 0);
                    GradientDrawable pill = new GradientDrawable();
                    pill.setColor(0x99000000);
                    pill.setCornerRadius(1000);
                    TextView view = new TextView(context);
                    view.setText(text);
                    view.setTextColor(Color.WHITE);
                    view.setTextSize(14);
                    view.setPadding(28, 12, 32, 12);
                    view.setBackground(pill);
                    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                            PixelFormat.TRANSLUCENT);
                    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    params.y = 32;
                    wm.addView(view, params);
                    indicator = view;
                } else if (!show && indicator != null) {
                    wm.removeView(indicator);
                    indicator = null;
                }
            }
        });
    }

    private final class Events implements PeerConnection.Observer {
        private final int call;
        private final CountDownLatch gathered;

        Events(int call, CountDownLatch gathered) {
            this.call = call;
            this.gathered = gathered;
        }

        @Override
        public void onConnectionChange(PeerConnection.PeerConnectionState newState) {
            if (call != generation) return;
            switch (newState) {
                case CONNECTED:
                    state = "connected";
                    showIndicator(true);
                    changed.run();
                    break;
                case DISCONNECTED: // the caller vanished without hanging up; give the network 5 s to recover
                    main.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            if (call == generation && !"connected".equals(state)) closeIfCurrent(call);
                        }
                    }, 5000);
                    state = "reconnecting";
                    break;
                case FAILED:
                case CLOSED:
                    closeIfCurrent(call);
                    break;
                default:
                    break;
            }
        }

        @Override
        public void onIceGatheringChange(PeerConnection.IceGatheringState newState) {
            if (newState == PeerConnection.IceGatheringState.COMPLETE) gathered.countDown();
        }

        @Override public void onSignalingChange(PeerConnection.SignalingState s) { }
        @Override public void onIceConnectionChange(PeerConnection.IceConnectionState s) { }
        @Override public void onIceConnectionReceivingChange(boolean receiving) { }
        @Override public void onIceCandidate(IceCandidate candidate) { }
        @Override public void onIceCandidatesRemoved(IceCandidate[] candidates) { }
        @Override public void onAddStream(MediaStream stream) { }
        @Override public void onRemoveStream(MediaStream stream) { }
        @Override public void onDataChannel(DataChannel channel) { }
        @Override public void onRenegotiationNeeded() { }
    }

    /** Turns WebRTC's callback-style SDP calls into blocking ones (only ever used on the worker thread). */
    private static final class Sdp implements SdpObserver {
        private final CountDownLatch done = new CountDownLatch(1);
        private SessionDescription created;
        private String error;

        SessionDescription create(PeerConnection pc) throws Exception {
            pc.createAnswer(this, new MediaConstraints());
            return await();
        }

        void set(PeerConnection pc, SessionDescription description, boolean local) throws Exception {
            if (local) pc.setLocalDescription(this, description);
            else pc.setRemoteDescription(this, description);
            await();
        }

        private SessionDescription await() throws Exception {
            if (!done.await(5, TimeUnit.SECONDS)) throw new IOException("WebRTC timed out");
            if (error != null) throw new IOException(error);
            return created;
        }

        @Override public void onCreateSuccess(SessionDescription description) { created = description; done.countDown(); }
        @Override public void onSetSuccess() { done.countDown(); }
        @Override public void onCreateFailure(String message) { error = message; done.countDown(); }
        @Override public void onSetFailure(String message) { error = message; done.countDown(); }
    }
}
