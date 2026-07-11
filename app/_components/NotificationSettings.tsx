'use client';

import { Button, Dialog, Icon, Toggle } from '@sovereignfs/ui';
import { useEffect, useState, useTransition } from 'react';
import { getNotificationPrefs, saveNotificationPrefs } from '../_lib/actions';
import styles from './NotificationSettings.module.css';

/**
 * Due/overdue notification preferences (opt-in, per user) — the settings
 * surface for the scheduler in app/_jobs/due-reminders.ts. Rendered as a
 * bell button in the list sidebar's header; opens a small Dialog (which is
 * a full-screen sheet on mobile by the DS's own adaptive behaviour).
 *
 * The browser's IANA timezone is captured on every save — never shown or
 * asked for. "Morning" means the user's wall clock wherever they are when
 * they last touched these settings.
 */
export default function NotificationSettings() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [morningTime, setMorningTime] = useState('08:00');
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoaded(false);
    void getNotificationPrefs().then((prefs) => {
      if (cancelled) return;
      setEnabled(prefs.enabled);
      setMorningTime(prefs.morningTime);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleSave() {
    startTransition(async () => {
      await saveNotificationPrefs({
        enabled,
        morningTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 800);
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.bellBtn}
        aria-label="Notification settings"
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" size="sm" aria-hidden />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Notifications">
        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Due & overdue notifications</span>
              <span className={styles.rowHint}>
                A morning summary of tasks due today and overdue, plus a reminder when a task's
                due time arrives.
              </span>
            </div>
            <Toggle
              checked={enabled}
              onChange={setEnabled}
              disabled={!loaded}
              aria-label="Enable due and overdue notifications"
            />
          </div>

          <div className={styles.row}>
            <label className={styles.rowLabel} htmlFor="tasks-morning-time">
              Morning summary at
            </label>
            <input
              id="tasks-morning-time"
              className={styles.timeInput}
              type="time"
              value={morningTime}
              disabled={!loaded || !enabled}
              onChange={(e) => setMorningTime(e.target.value)}
            />
          </div>

          <p className={styles.pushHint}>
            To get notified while the app is closed, also enable push notifications for this
            device under Account → Notifications.
          </p>

          <div className={styles.footer}>
            <Button variant="primary" disabled={!loaded} onClick={handleSave}>
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
