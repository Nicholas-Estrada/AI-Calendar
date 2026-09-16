from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models import CalendarEvent


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    chunks: list[str] = []
    current = ""
    byte_count = 0
    for character in line:
        size = len(character.encode("utf-8"))
        if byte_count + size > 75:
            chunks.append(current)
            current = " "
            byte_count = 1
        current += character
        byte_count += size
    chunks.append(current)
    return "\r\n".join(chunks)


def _ical_date(value: date) -> str:
    return value.strftime("%Y%m%d")


def build_calendar(events: list[CalendarEvent]) -> bytes:
    now = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AI Calendar//Academic Scheduler//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AI Calendar",
    ]
    for event in events:
        description = event.extendedProps.get("description", "")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{_escape(event.id)}@lias.local",
                f"DTSTAMP:{now}",
                f"DTSTART;VALUE=DATE:{_ical_date(event.start)}",
                f"SUMMARY:{_escape(event.title)}",
                f"DESCRIPTION:{_escape(description)}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return ("\r\n".join(_fold(line) for line in lines) + "\r\n").encode("utf-8")


def build_firestore_calendar(events: list[dict], time_zone: str = "UTC") -> bytes:
    now = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    try:
        zone = ZoneInfo(time_zone)
    except ZoneInfoNotFoundError:
        zone = UTC
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AI Calendar//Academic Scheduler//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AI Calendar",
    ]
    for event in events:
        start = event.get("start")
        title = event.get("title")
        event_id = event.get("id")
        if not all(isinstance(value, str) and value for value in (start, title, event_id)):
            continue
        all_day = event.get("allDay", len(start) == 10)
        if all_day:
            try:
                start_date = date.fromisoformat(start[:10])
                end_date = date.fromordinal(start_date.toordinal() + 1)
            except ValueError:
                continue
            start_line = f"DTSTART;VALUE=DATE:{_ical_date(start_date)}"
            end_line = f"DTEND;VALUE=DATE:{_ical_date(end_date)}"
        else:
            end = event.get("end")
            if not isinstance(end, str) or len(start) != 19 or len(end) != 19:
                continue
            try:
                start_at = datetime.fromisoformat(start).replace(tzinfo=zone)
                end_at = datetime.fromisoformat(end).replace(tzinfo=zone)
            except ValueError:
                continue
            if end_at <= start_at:
                continue
            start_line = f"DTSTART:{start_at.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')}"
            end_line = f"DTEND:{end_at.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')}"
        description = event.get("description")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{_escape(event_id)}@ai-calendar.local",
                f"DTSTAMP:{now}",
                start_line,
                end_line,
                f"SUMMARY:{_escape(title)}",
            ]
        )
        if isinstance(description, str) and description:
            lines.append(f"DESCRIPTION:{_escape(description)}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return ("\r\n".join(_fold(line) for line in lines) + "\r\n").encode("utf-8")
