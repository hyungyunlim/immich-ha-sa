# Family Notices and Calendar

Notices are short lines, such as *🍽️ Dinner out at 7 tonight*, that frames show as a small pill near the bottom of the slideshow. With several notices, the frame shows them one at a time, switching every 8 seconds.

## From the Frames panel

Open **Frames** in the Home Assistant sidebar and choose the **Notices** tab.

1. Type the notice (up to 140 characters; emoji welcome).
2. Pick **All frames** or tap one or more frames, and how long to show it: until tonight, until tomorrow night, 1 hour, 1 week, or until deleted.
3. Select **Show on frames**. Frames update within a second.

The list below the form shows every notice on the frames, where it shows, and until when. **Edit** loads a notice into the form: change the text, the frames, or how long it stays (or keep its current end), then select **Save changes**, or **Cancel**. **Delete** removes it from the frames right away. Expired notices disappear by themselves.

Notices work on every frame the controller serves; no companion app is needed. Frames hide them while the screen is off.

## Calendar events

The **Calendar** tab of the **Frames** panel shows upcoming events from Home Assistant calendars between the notices, such as *[Today] 19:00 Swimming* or *[Tomorrow] All day Grandma's birthday*. Each frame has its own calendars, days, and widget setting, so the kitchen can show the family calendar while grandma's frame shows only the grandchildren's events.

1. Pick a frame at the top of the tab. Frames that already show an agenda have a dot.
2. Tick the calendars to show on it. Any Home Assistant calendar works: the Google Calendar integration, Remote Calendar (an iCal link), or a local calendar.
3. Choose today only, the next 3 days, or the next week.
4. Select **Save**. The list below shows what that frame will display.

A frame with no calendars ticked and the widget off shows no agenda. Settings from before 0.1.108, when every chosen frame shared one setting, carry over to each of those frames.

### Calendar widget

Turn on **Show as a calendar widget** to replace the pill with a small, quiet card near the bottom of the frame: this month's calendar with today circled and a dot on days with events, next to a *Today's events* list of the next events (today's events show their time; later ones also show their day). Notices keep their own pill, just above the card. It works without any calendar ticked too, as a month calendar. Turn it off and events take turns with the notices in the pill again.

The integration rereads the calendars every 15 minutes and right after you save. Frames show the next five events that have not ended, after the notices, with today's events marked in amber. Events in two subscribed copies of the same calendar show once.

## From automations

`immich_frame.show_notice` posts a notice from an automation or script:

```yaml
action: immich_frame.show_notice
data:
  message: "🧺 The laundry is done"
  duration: 60        # minutes; leave out to keep it until deleted
  device_id: kitchen  # controller device id; leave out for every frame
```
