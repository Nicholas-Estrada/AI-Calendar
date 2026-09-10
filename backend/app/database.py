import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from app.models import (
    Assignment,
    CalendarEvent,
    CommitScheduleRequest,
    CommittedSchedule,
    Milestone,
    MilestoneStatus,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    raw_prompt TEXT,
    final_due_date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    title TEXT NOT NULL,
    target_date TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('PENDING', 'COMPLETED')) DEFAULT 'PENDING',
    FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(final_due_date);
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_assignment_id ON milestones(assignment_id);
"""


def initialize_database(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as connection:
        connection.executescript(SCHEMA)


@contextmanager
def connect(path: Path) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def commit_schedule(path: Path, request: CommitScheduleRequest) -> CommittedSchedule:
    assignment_id = str(uuid4())
    milestone_ids = [str(uuid4()) for _ in request.events]

    with connect(path) as connection:
        connection.execute(
            """
            INSERT INTO assignments (id, title, raw_prompt, final_due_date)
            VALUES (?, ?, ?, ?)
            """,
            (
                assignment_id,
                request.assignment_title,
                request.raw_prompt,
                request.final_due_date.isoformat(),
            ),
        )
        connection.executemany(
            """
            INSERT INTO milestones
                (id, assignment_id, title, target_date, description, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
            """,
            [
                (
                    milestone_id,
                    assignment_id,
                    event.title,
                    event.date.isoformat(),
                    event.description,
                )
                for milestone_id, event in zip(milestone_ids, request.events, strict=True)
            ],
        )

        assignment_row = connection.execute(
            "SELECT * FROM assignments WHERE id = ?", (assignment_id,)
        ).fetchone()
        milestone_rows = connection.execute(
            "SELECT * FROM milestones WHERE assignment_id = ? ORDER BY target_date",
            (assignment_id,),
        ).fetchall()

    if assignment_row is None:
        raise RuntimeError("Failed to read the committed assignment")

    return CommittedSchedule(
        assignment=Assignment(
            id=assignment_row["id"],
            title=assignment_row["title"],
            raw_prompt=assignment_row["raw_prompt"],
            final_due_date=date.fromisoformat(assignment_row["final_due_date"]),
            created_at=datetime.fromisoformat(assignment_row["created_at"]),
        ),
        milestones=[
            Milestone(
                id=row["id"],
                assignment_id=row["assignment_id"],
                title=row["title"],
                target_date=date.fromisoformat(row["target_date"]),
                description=row["description"],
                status=MilestoneStatus(row["status"]),
            )
            for row in milestone_rows
        ],
    )


def list_calendar_events(path: Path) -> list[CalendarEvent]:
    with connect(path) as connection:
        assignment_rows = connection.execute(
            "SELECT id, title, final_due_date FROM assignments ORDER BY final_due_date"
        ).fetchall()
        milestone_rows = connection.execute(
            """
            SELECT milestones.id, milestones.assignment_id, milestones.title,
                   milestones.target_date, milestones.description, milestones.status,
                   assignments.title AS assignment_title
            FROM milestones
            JOIN assignments ON assignments.id = milestones.assignment_id
            ORDER BY milestones.target_date
            """
        ).fetchall()

    deadlines = [
        CalendarEvent(
            id=f"assignment:{row['id']}",
            title=f"Due: {row['title']}",
            start=date.fromisoformat(row["final_due_date"]),
            backgroundColor="#ef4444",
            borderColor="#dc2626",
            extendedProps={"kind": "deadline", "assignmentId": row["id"]},
        )
        for row in assignment_rows
    ]
    milestones = [
        CalendarEvent(
            id=f"milestone:{row['id']}",
            title=row["title"],
            start=date.fromisoformat(row["target_date"]),
            backgroundColor="#eab308",
            borderColor="#ca8a04",
            extendedProps={
                "kind": "milestone",
                "assignmentId": row["assignment_id"],
                "assignmentTitle": row["assignment_title"],
                "description": row["description"] or "",
                "status": row["status"],
            },
        )
        for row in milestone_rows
    ]
    return sorted([*deadlines, *milestones], key=lambda event: event.start)
