from datetime import UTC, date, datetime

from app.models import CalendarEvent


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    chunks = [line[index : index + 73] for index in range(0, len(line), 73)]
    return "\r\n ".join(chunks)


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
