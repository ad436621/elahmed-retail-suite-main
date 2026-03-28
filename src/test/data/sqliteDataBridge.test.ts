import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addToBlacklist, getBlacklist } from '@/data/blacklistData';
import { getCustomers } from '@/data/customersData';
import { getOtherRevenues } from '@/data/otherRevenueData';
import { addReminder, markReminderDone } from '@/data/remindersData';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  delete (window as typeof window & { electron?: unknown }).electron;
});

describe('sqlite-backed data modules', () => {
  it('reads customers from SQLite sync bridge', () => {
    const sendSync = vi.fn((channel: string) => {
      if (channel === 'db-sync:customers:get') {
        return [
          {
            id: 'cust-1',
            name: 'Ahmed',
            phone: '01000000000',
            address: 'Cairo',
            email: 'ahmed@example.com',
            notes: 'VIP',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const customers = getCustomers();

    expect(sendSync).toHaveBeenCalledWith('db-sync:customers:get');
    expect(customers).toEqual([
      {
        id: 'cust-1',
        name: 'Ahmed',
        phone: '01000000000',
        address: 'Cairo',
        email: 'ahmed@example.com',
        notes: 'VIP',
        createdAt: '2026-01-01T00:00:00.000Z',
        isArchived: false,
        deletedAt: null,
      },
    ]);
  });

  it('writes blacklist entries through SQLite sync bridge with cleaned IMEI', () => {
    const sendSync = vi.fn((channel: string, payload?: Record<string, unknown>) => {
      if (channel === 'db-sync:blacklist:add') {
        return {
          ...payload,
          id: payload?.id ?? 'bl-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        };
      }
      if (channel === 'db-sync:blacklist:get') {
        return [];
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const entry = addToBlacklist({
      imei: '123 456 789',
      deviceName: 'Galaxy S24',
      ownerName: 'Mahmoud',
      ownerPhone: '01011111111',
      reason: 'stolen',
      reportedDate: '2026-03-01',
      status: 'active',
      notes: 'Case open',
      createdBy: 'Admin',
    });

    expect(sendSync).toHaveBeenCalledWith(
      'db-sync:blacklist:add',
      expect.objectContaining({
        imei: '123456789',
        deviceName: 'Galaxy S24',
        ownerPhone: '01011111111',
      }),
    );
    expect(entry.imei).toBe('123456789');
    expect(entry.deviceName).toBe('Galaxy S24');
  });

  it('maps other revenue SQLite source field to category', () => {
    const sendSync = vi.fn((channel: string) => {
      if (channel === 'db-sync:other_revenue:get') {
        return [
          {
            id: 'rev-1',
            date: '2026-03-01',
            description: 'Distributor commission',
            amount: 2500,
            source: 'commission',
            addedBy: 'Admin',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ];
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const revenues = getOtherRevenues();

    expect(revenues[0].category).toBe('commission');
    expect(revenues[0].addedBy).toBe('Admin');
  });

  it('updates reminder status through SQLite sync bridge when marking done', () => {
    let reminders = [
      {
        id: 'rem-1',
        title: 'Pay supplier',
        dueDate: '2026-03-27',
        priority: 'medium',
        status: 'pending',
        category: 'supplier',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ];

    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:reminders:get') {
        return reminders;
      }
      if (channel === 'db-sync:reminders:update') {
        const id = args[0] as string;
        const data = args[1] as Record<string, unknown>;
        reminders = reminders.map((r) => (r.id === id ? { ...r, ...data } : r));
        return { id, ...data };
      }
      if (channel === 'db-sync:reminders:add') {
        const newReminder = { id: 'rem-1', ...(args[0] as Record<string, unknown>) };
        reminders.push(newReminder as typeof reminders[0]);
        return newReminder;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    addReminder({
      title: 'Pay supplier',
      reminderDate: '2026-03-27',
      reminderTime: '',
      category: 'supplier',
      priority: 'medium',
      status: 'pending',
      notes: '',
    });
    markReminderDone('rem-1');

    expect(sendSync).toHaveBeenCalledTimes(3);
    const updateCall = sendSync.mock.calls[2];
    expect(updateCall[0]).toBe('db-sync:reminders:update');
    expect(updateCall[1]).toBe('rem-1');
    expect(updateCall[2].status).toBe('done');
    expect(updateCall[2].completed).toBe(true);
  });
});
