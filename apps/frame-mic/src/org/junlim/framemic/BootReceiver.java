package org.junlim.framemic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Brings the stream service back after a reboot or an app update so it can be switched on remotely. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            context.startForegroundService(new Intent(context, StreamService.class));
        }
    }
}
