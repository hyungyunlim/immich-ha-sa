# Family Notices

Notices are short lines, such as *🍽️ Dinner out at 7 tonight*, that frames show as a small pill near the bottom of the slideshow. With several notices, the frame shows them one at a time, switching every 8 seconds.

## From the Frames panel

Open **Frames** in the Home Assistant sidebar and choose the **Notices** tab.

1. Type the notice (up to 140 characters; emoji welcome).
2. Pick **All frames** or one frame, and how long to show it: until tonight, until tomorrow night, 1 hour, 1 week, or until deleted.
3. Select **Show on frames**. Frames update within a second.

The list below the form shows every notice on the frames, where it shows, and until when. **Delete** removes it from the frames right away. Expired notices disappear by themselves.

Notices work on every frame the controller serves; no companion app is needed. Frames hide them while the screen is off.

## From automations

`immich_frame.show_notice` posts a notice from an automation or script:

```yaml
action: immich_frame.show_notice
data:
  message: "🧺 The laundry is done"
  duration: 60        # minutes; leave out to keep it until deleted
  device_id: kitchen  # controller device id; leave out for every frame
```
