import { describe, it, expect } from 'vitest';
import { computeSlaCountdown, bucketRoiRecordsByWeek } from '../src/lib/utils';

describe('SLA Countdown & Auto-RTO Calculation Engine', () => {
  const baseNow = new Date('2026-10-11T12:00:00.000Z').getTime();

  it('handles missing or null detectedAt with "Awaiting scan"', () => {
    const res1 = computeSlaCountdown('delhivery', null, baseNow);
    expect(res1.text).toBe('Awaiting scan');
    expect(res1.className).toContain('--safe');

    const res2 = computeSlaCountdown('shiprocket', undefined, baseNow);
    expect(res2.text).toBe('Awaiting scan');

    const res3 = computeSlaCountdown('bluedart', 'invalid-date-string', baseNow);
    expect(res3.text).toBe('Awaiting scan');
  });

  it('enforces 48-hour SLA for Delhivery shipments', () => {
    // Detected 10 hours ago -> 38h remaining
    const detectedAt = new Date(baseNow - 10 * 3600 * 1000).toISOString();
    const res = computeSlaCountdown('delhivery', detectedAt, baseNow);
    expect(res.text).toBe('38h 00m');
    expect(res.className).toContain('--safe');
  });

  it('enforces 24-hour SLA for standard carriers (Shiprocket, Bluedart, Shadowfax)', () => {
    // Detected 10 hours ago -> 14h remaining
    const detectedAt = new Date(baseNow - 10 * 3600 * 1000).toISOString();
    const res = computeSlaCountdown('shiprocket', detectedAt, baseNow);
    expect(res.text).toBe('14h 00m');
    expect(res.className).toContain('--safe');
  });

  it('flags urgent threshold when SLA has <= 3 hours remaining', () => {
    // Detected 22 hours ago on 24h SLA -> 2h remaining
    const detectedAt = new Date(baseNow - 22 * 3600 * 1000).toISOString();
    const res = computeSlaCountdown('shadowfax', detectedAt, baseNow);
    expect(res.text).toBe('02h 00m');
    expect(res.className).toContain('--urgent');
  });

  it('flags warning threshold when SLA has <= 8 hours remaining', () => {
    // Detected 18 hours ago on 24h SLA -> 6h remaining
    const detectedAt = new Date(baseNow - 18 * 3600 * 1000).toISOString();
    const res = computeSlaCountdown('bluedart', detectedAt, baseNow);
    expect(res.text).toBe('06h 00m');
    expect(res.className).toContain('--warning');
  });

  it('distinguishes "RTO Initiated" vs "SLA elapsed" honestly when deadline expires', () => {
    // 30 hours ago on 24h SLA -> expired
    const detectedAt = new Date(baseNow - 30 * 3600 * 1000).toISOString();

    // Order whose carrier status confirmed RTO
    const resRto = computeSlaCountdown('shiprocket', detectedAt, baseNow, 'rto_initiated');
    expect(resRto.text).toBe('RTO Initiated');
    expect(resRto.className).toContain('--urgent');

    // Order where SLA passed but carrier has not marked RTO
    const resElapsed = computeSlaCountdown('shiprocket', detectedAt, baseNow, 'ndr_detected');
    expect(resElapsed.text).toBe('SLA elapsed');
    expect(resElapsed.className).toContain('--urgent');
  });
});

describe('High-Volume ROI Bucketing & Aggregation Engine', () => {
  it('returns empty array [] on null, undefined, or empty records (triggers honest zero-state)', () => {
    expect(bucketRoiRecordsByWeek([])).toEqual([]);
    expect(bucketRoiRecordsByWeek(null as any)).toEqual([]);
    expect(bucketRoiRecordsByWeek(undefined as any)).toEqual([]);
  });

  it('evenly distributes 10,000 synthetic benchmark records into 4 balanced buckets for Recharts performance tests', () => {
    const fixedIso = new Date('2026-10-11T10:00:00.000Z').toISOString();
    const highVolumeRecords = Array.from({ length: 10000 }, (_, i) => ({
      id: `rec_${i}`,
      amount: 140,
      timestamp: fixedIso,
    }));

    const buckets = bucketRoiRecordsByWeek(highVolumeRecords);
    expect(buckets.length).toBe(4);
    expect(buckets[0]).toEqual({ period: 'Week 1', saved: 350000 });
    expect(buckets[1]).toEqual({ period: 'Week 2', saved: 350000 });
    expect(buckets[2]).toEqual({ period: 'Week 3', saved: 350000 });
    expect(buckets[3]).toEqual({ period: 'Week 4', saved: 350000 });
  });

  it('buckets real records with diverse calendar dates into genuine ISO weeks', () => {
    const realRecords = [
      // September week
      { id: '1', amount: 500, timestamp: '2026-09-02T10:00:00.000Z' },
      { id: '2', amount: 300, timestamp: '2026-09-04T12:00:00.000Z' },
      // Later week
      { id: '3', amount: 1200, timestamp: '2026-09-15T09:00:00.000Z' },
      { id: '4', amount: 800, timestamp: '2026-09-22T14:00:00.000Z' },
    ];

    const buckets = bucketRoiRecordsByWeek(realRecords);
    expect(buckets.length).toBe(3);
    expect(buckets[0].saved).toBe(800); // 500 + 300
    expect(buckets[1].saved).toBe(1200);
    expect(buckets[2].saved).toBe(800);
  });
});
