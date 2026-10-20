package org.junlim.framemic;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.TextView;

/** Asks for the microphone once, then starts the stream service and shows its URL. */
public class MainActivity extends Activity {
    private TextView text;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        text = new TextView(this);
        text.setTextSize(24);
        text.setPadding(48, 48, 48, 48);
        setContentView(text);
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            start();
        } else {
            text.setText("Allow microphone access to start the stream.");
            requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, 1);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            start();
        } else {
            text.setText("Microphone permission denied. Grant it in Settings > Apps > Frame Mic.");
        }
    }

    private void start() {
        startForegroundService(new Intent(this, StreamService.class));
        text.setText("Frame Mic v" + StreamService.VERSION + " is running.\n\n"
                + "Frame Mic key:  " + StreamService.key(this) + "\n"
                + "Enter this key in the controller console (device > Frame Mic Key).\n\n"
                + "Listening stays off until it is switched on from Home Assistant,\n"
                + "and the mic opens only while someone listens.\n\n"
                + StreamService.url(this)
                + (Settings.canDrawOverlays(this) ? ""
                : "\n\nAllow \"Display over other apps\" so calls show a small indicator on screen."));
        if (!Settings.canDrawOverlays(this)) {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
        }
    }
}
