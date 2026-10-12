package com.shaikibrahim.locat;

/** Single byte-range parsing with long offsets, independent of Android for JVM tests. */
public final class MediaByteRange {
    private MediaByteRange() {}
    public static long[] parse(String range, long length) {
        if (length <= 0) return null;
        if (range == null) return new long[] {0, length - 1};
        if (!range.matches("bytes=[0-9]*-[0-9]*")) return null;
        String[] parts = range.substring(6).split("-", -1);
        try {
            long start, end;
            if (parts[0].isEmpty()) {
                if (parts[1].isEmpty()) return null;
                long suffix = Long.parseLong(parts[1]);
                if (suffix <= 0) return null;
                start = Math.max(0, length - suffix); end = length - 1;
            } else {
                start = Long.parseLong(parts[0]);
                end = parts[1].isEmpty() ? length - 1 : Math.min(length - 1, Long.parseLong(parts[1]));
            }
            if (start < 0 || start >= length || end < start) return null;
            return new long[] {start, end};
        } catch (NumberFormatException error) { return null; }
    }
}
