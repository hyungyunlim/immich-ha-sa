# Family Notices and Calendar

Notices are short lines, such as *🍽️ Dinner out at 7 tonight*, that frames show as a small pill near the bottom of the slideshow. With several notices, the frame shows them one at a time, switching every 8 seconds.

## From the Frames panel

Open **Frames** in the Home Assistant sidebar and choose the **Notices** tab.

1. Type the notice (up to 140 characters; emoji welcome).
2. Pick **All frames** or one frame, and how long to show it: until tonight, until tomorrow night, 1 hour, 1 week, or until deleted.
3. Select **Show on frames**. Frames update within a second.

The list below the form shows every notice on the frames, where it shows, and until when. **Delete** removes it from the frames right away. Expired notices disappear by themselves.

Notices work on every frame the controller serves; no companion app is needed. Frames hide them while the screen is off.

## Calendar events

The **Calendar** tab of the **Frames** panel shows upcoming events from Home Assistant calendars between the notices, such as *[Today] 19:00 Swimming* or *[Tomorrow] All day Grandma's birthday*.

1. Tick the calendars to show. Any Home Assistant calendar works: the Google Calendar integration, Remote Calendar (an iCal link), or a local calendar.
2. Tick the frames that show them, and choose today only, the next 3 days, or the next week.
3. Select **Save**. The list below shows what the frames will display.

### Calendar widget

Turn on **Show as a calendar widget** to replace the pill with a card near the bottom of the frame: this month's calendar with today circled and a dot on days with events, next to today's date and a list of the notices and next events. It works without any calendar ticked too, as a month calendar with the notices. Turn it off to go back to the pill.

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
