package org.junlim.framemic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Brings the stream service back after a reboot so it can be switched on remotely. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            context.startForegroundService(new Intent(context, StreamService.class));
        }
    }
}
