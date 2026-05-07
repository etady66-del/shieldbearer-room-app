import React, { useMemo, useState } from "react";

const ROOMS = Array.from({ length: 10 }, (_, i) => `Room ${i + 1}`);

const TIME_SLOTS = [
    "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
    "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
    "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"
];

const DEFAULT_THERAPISTS = [
    "Dr. Sarah Johnson",
    "Michael Smith, LPC",
    "Rebecca Lee, LMFT",
    "Daniel Garcia, LPC-Associate",
    "Angela Brown, LCSW"
];

export default function App() {
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [therapists, setTherapists] = useState(DEFAULT_THERAPISTS);
    const [newTherapist, setNewTherapist] = useState("");
    const [selectedTherapist, setSelectedTherapist] = useState(DEFAULT_THERAPISTS[0]);
    const [assignments, setAssignments] = useState({});
    const [message, setMessage] = useState("");

    const dateAssignments = assignments[selectedDate] || {};
    const bookedCount = useMemo(() => Object.keys(dateAssignments).length, [dateAssignments]);
    const totalSlots = ROOMS.length * TIME_SLOTS.length;

    function slotKey(room, time) {
        return `${room}|${time}`;
    }

    function therapistAlreadyBooked(time, therapist) {
        return Object.entries(dateAssignments).some(([key, value]) => {
            const [, bookedTime] = key.split("|");
            return bookedTime === time && value === therapist;
        });
    }

    function assignRoom(room, time) {
        if (!selectedTherapist) {
            setMessage("Please select a therapist first.");
            return;
        }

        if (therapistAlreadyBooked(time, selectedTherapist)) {
            setMessage(`${selectedTherapist} is already booked at ${time}.`);
            return;
        }

        const key = slotKey(room, time);
        setAssignments((prev) => ({
            ...prev,
            [selectedDate]: {
                ...(prev[selectedDate] || {}),
                [key]: selectedTherapist,
            },
        }));
        setMessage(`${selectedTherapist} assigned to ${room} at ${time}.`);
    }

    function clearSlot(room, time) {
        const key = slotKey(room, time);
        setAssignments((prev) => {
            const updatedDate = { ...(prev[selectedDate] || {}) };
            delete updatedDate[key];
            return { ...prev, [selectedDate]: updatedDate };
        });
        setMessage(`${room} at ${time} is now open.`);
    }

    function addTherapist() {
        const name = newTherapist.trim();
        if (!name) return;
        if (therapists.includes(name)) {
            setMessage("That therapist is already in the list.");
            return;
        }
        setTherapists((prev) => [...prev, name].sort());
        setSelectedTherapist(name);
        setNewTherapist("");
        setMessage(`${name} added to the therapist list.`);
    }

    function clearDay() {
        setAssignments((prev) => ({ ...prev, [selectedDate]: {} }));
        setMessage("All room assignments for this date have been cleared.");
    }

    const styles = {
        page: { minHeight: "100vh", background: "#f4f6f8", padding: 24, fontFamily: "Arial, sans-serif" },
        container: { maxWidth: 1300, margin: "0 auto" },
        header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" },
        title: { margin: 0, fontSize: 30, color: "#111827" },
        subtitle: { color: "#4b5563", marginTop: 8 },
        card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginTop: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
        controls: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
        label: { display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#374151" },
        input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14 },
        button: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 700 },
        primaryButton: { padding: "10px 12px", borderRadius: 10, border: "none", background: "#2563eb", color: "white", cursor: "pointer", fontWeight: 700 },
        dangerButton: { padding: "10px 12px", borderRadius: 10, border: "none", background: "#dc2626", color: "white", cursor: "pointer", fontWeight: 700, width: "100%" },
        tableWrap: { overflowX: "auto", marginTop: 16, background: "white", borderRadius: 16, border: "1px solid #e5e7eb" },
        table: { width: "100%", minWidth: 1100, borderCollapse: "collapse" },
        th: { background: "#eef2f7", padding: 12, textAlign: "left", borderBottom: "1px solid #d1d5db" },
        td: { padding: 8, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
        timeCell: { padding: 12, borderBottom: "1px solid #e5e7eb", fontWeight: 700, background: "white" },
        assignment: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 },
        small: { fontSize: 12, color: "#6b7280" },
        note: { fontSize: 12, color: "#6b7280", marginTop: 12 },
    };

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>Shieldbearer Counseling Room Allocator</h1>
                        <p style={styles.subtitle}>Assign therapists to 10 rooms for one-hour sessions from 8:00 AM to 8:00 PM.</p>
                    </div>
                    <div style={styles.card}>
                        <strong>Booked Slots:</strong> {bookedCount} / {totalSlots}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.controls}>
                        <div>
                            <label style={styles.label}>Schedule Date</label>
                            <input style={styles.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        </div>

                        <div>
                            <label style={styles.label}>Therapist</label>
                            <select style={styles.input} value={selectedTherapist} onChange={(e) => setSelectedTherapist(e.target.value)}>
                                {therapists.map((therapist) => <option key={therapist} value={therapist}>{therapist}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={styles.label}>Add Therapist</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input style={styles.input} placeholder="Enter therapist name" value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTherapist()} />
                                <button style={styles.primaryButton} onClick={addTherapist}>Add</button>
                            </div>
                        </div>

                        <div>
                            <label style={styles.label}>Clear Schedule</label>
                            <button style={styles.dangerButton} onClick={clearDay}>Clear Date</button>
                        </div>
                    </div>
                </div>

                {message && <div style={styles.card}>{message}</div>}

                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Time</th>
                                {ROOMS.map((room) => <th key={room} style={styles.th}>{room}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {TIME_SLOTS.map((time) => (
                                <tr key={time}>
                                    <td style={styles.timeCell}>{time}</td>
                                    {ROOMS.map((room) => {
                                        const key = slotKey(room, time);
                                        const assigned = dateAssignments[key];
                                        return (
                                            <td key={key} style={styles.td}>
                                                {assigned ? (
                                                    <div style={styles.assignment}>
                                                        <strong>{assigned}</strong>
                                                        <div style={styles.small}>{room} • {time}</div>
                                                        <button style={{ ...styles.button, marginTop: 8, padding: "6px 8px" }} onClick={() => clearSlot(room, time)}>Clear</button>
                                                    </div>
                                                ) : (
                                                    <button style={{ ...styles.button, width: "100%", minHeight: 56 }} onClick={() => assignRoom(room, time)}>Assign</button>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p style={styles.note}>Note: This version stores assignments in the browser session only. For shared office use, it should be connected to a secure database and login system.</p>
            </div>
        </div>
    );
}
