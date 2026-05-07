import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    onSnapshot,
    setDoc,
    deleteDoc,
    doc,
    getDocs,
} from "firebase/firestore";

/*
  STEP 1: Create a Firebase project at https://console.firebase.google.com
  STEP 2: Create a Firestore Database
  STEP 3: Replace the firebaseConfig below with your own Firebase web app config
  STEP 4: Run: npm install firebase
  STEP 5: Run: npm run dev
*/

const firebaseConfig = {
    apiKey: "PASTE_YOUR_API_KEY_HERE",
    authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
    projectId: "PASTE_YOUR_PROJECT_ID_HERE",
    storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "PASTE_YOUR_APP_ID_HERE",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ROOMS = Array.from({ length: 10 }, (_, i) => `Room ${i + 1}`);

const TIME_SLOTS = [
    "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
    "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
    "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"
];

const DEFAULT_THERAPISTS = [
    "Michelle Temofonte",
    "Alexis Melton",
    "Lynsey Poblete",
    "JoAnna L. Arnold",
    "Robert Davidoski",
    "George W. Hebert II",
    "April Elfman",
    "Angela Futch",
    "Anna Larissa Dos Santos",
    "Mary Nkaginieme",
    "Vanessa Hall",
    "Lauren Hwang",
    "Katelynn Lincoln"
];

function makeSafeId(text) {
    return text.replace(/[^a-zA-Z0-9]/g, "_");
}

export default function App() {
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [therapists, setTherapists] = useState(DEFAULT_THERAPISTS);
    const [newTherapist, setNewTherapist] = useState("");
    const [selectedTherapist, setSelectedTherapist] = useState(DEFAULT_THERAPISTS[0]);
    const [assignments, setAssignments] = useState({});
    const [message, setMessage] = useState("Connecting to shared schedule...");
    const [viewMode, setViewMode] = useState("therapist");
    const [adminPassword, setAdminPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    // Simple temporary password. Change this to whatever you want.
    // For stronger security later, use Firebase Authentication instead.
    const ADMIN_PASSWORD = "shieldbearer123";

    const dateAssignments = assignments[selectedDate] || {};
    const bookedCount = useMemo(() => Object.keys(dateAssignments).length, [dateAssignments]);
    const totalSlots = ROOMS.length * TIME_SLOTS.length;

    useEffect(() => {
        const assignmentsRef = collection(db, "roomAssignments", selectedDate, "slots");

        const unsubscribe = onSnapshot(
            assignmentsRef,
            (snapshot) => {
                const liveAssignments = {};
                snapshot.forEach((document) => {
                    const data = document.data();
                    liveAssignments[document.id] = data.therapist;
                });
                setAssignments((prev) => ({ ...prev, [selectedDate]: liveAssignments }));
                setMessage("Shared schedule loaded. Updates appear automatically.");
            },
            (error) => {
                console.error(error);
                setMessage("Could not connect to Firebase. Check your Firebase config and Firestore rules.");
            }
        );

        return () => unsubscribe();
    }, [selectedDate]);

    useEffect(() => {
        const therapistsRef = collection(db, "therapists");

        const unsubscribe = onSnapshot(therapistsRef, (snapshot) => {
            const names = [];
            snapshot.forEach((document) => names.push(document.data().name));

            const merged = Array.from(new Set([...DEFAULT_THERAPISTS, ...names])).sort();
            setTherapists(merged);
            if (!merged.includes(selectedTherapist)) setSelectedTherapist(merged[0] || "");
        });

        return () => unsubscribe();
    }, [selectedTherapist]);

    function slotKey(room, time) {
        return `${makeSafeId(room)}__${makeSafeId(time)}`;
    }

    function readableSlot(documentId) {
        const match = Object.entries(dateAssignments).find(([key]) => key === documentId);
        return match ? match[0] : documentId;
    }

    function therapistAlreadyBooked(time, therapist) {
        return Object.entries(dateAssignments).some(([key, value]) => {
            const expectedTimePart = makeSafeId(time);
            return key.endsWith(`__${expectedTimePart}`) && value === therapist;
        });
    }

    async function assignRoom(room, time) {
        if (!isAdmin) {
            setMessage("Switch to Admin View to edit the schedule.");
            return;
        }

        if (!selectedTherapist) {
            setMessage("Please select a therapist first.");
            return;
        }

        if (therapistAlreadyBooked(time, selectedTherapist)) {
            setMessage(`${selectedTherapist} is already booked at ${time}.`);
            return;
        }

        const key = slotKey(room, time);
        await setDoc(doc(db, "roomAssignments", selectedDate, "slots", key), {
            therapist: selectedTherapist,
            room,
            time,
            date: selectedDate,
            updatedAt: new Date().toISOString(),
        });

        setMessage(`${selectedTherapist} assigned to ${room} at ${time}.`);
    }

    async function clearSlot(room, time) {
        if (!isAdmin) {
            setMessage("Switch to Admin View to edit the schedule.");
            return;
        }

        const key = slotKey(room, time);
        await deleteDoc(doc(db, "roomAssignments", selectedDate, "slots", key));
        setMessage(`${room} at ${time} is now open.`);
    }

    async function addTherapist() {
        const name = newTherapist.trim();
        if (!name) return;

        await setDoc(doc(db, "therapists", makeSafeId(name)), { name });
        setSelectedTherapist(name);
        setNewTherapist("");
        setMessage(`${name} added to the shared therapist list.`);
    }

    async function removeTherapist() {
        if (!isAdmin) {
            setMessage("Switch to Admin View to remove therapists.");
            return;
        }

        if (!selectedTherapist) {
            setMessage("Please select a therapist to remove.");
            return;
        }

        const confirmed = window.confirm(
            `Remove ${selectedTherapist} from the therapist list? Existing room assignments will not be deleted.`
        );

        if (!confirmed) return;

        await deleteDoc(doc(db, "therapists", makeSafeId(selectedTherapist)));

        const remainingTherapists = therapists.filter((name) => name !== selectedTherapist);
        setSelectedTherapist(remainingTherapists[0] || "");
        setMessage(`${selectedTherapist} removed from the shared therapist list.`);
    }

    async function clearDay() {
        if (!isAdmin) {
            setMessage("Switch to Admin View to edit the schedule.");
            return;
        }

        const snapshot = await getDocs(collection(db, "roomAssignments", selectedDate, "slots"));
        const deletes = snapshot.docs.map((document) => deleteDoc(document.ref));
        await Promise.all(deletes);
        setMessage("All room assignments for this date have been cleared.");
    }

    function loginAdmin() {
        if (adminPassword === ADMIN_PASSWORD) {
            setIsAdmin(true);
            setViewMode("admin");
            setAdminPassword("");
            setMessage("Admin editing enabled.");
        } else {
            setMessage("Incorrect admin password.");
        }
    }

    function logoutAdmin() {
        setIsAdmin(false);
        setViewMode("therapist");
        setMessage("Admin editing disabled. You are now in therapist view.");
    }

    function therapistSchedule() {
        return Object.entries(dateAssignments)
            .map(([key, therapist]) => {
                const room = ROOMS.find((r) => key.startsWith(makeSafeId(r)));
                const time = TIME_SLOTS.find((t) => key.endsWith(makeSafeId(t)));
                return { key, therapist, room, time };
            })
            .filter((item) => item.therapist === selectedTherapist)
            .sort((a, b) => TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time));
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

    const mySchedule = therapistSchedule();

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>Shieldbearer Counseling Room Allocator</h1>
                        <p style={styles.subtitle}>Shared online schedule for 10 rooms, one-hour sessions, 8:00 AM to 8:00 PM.</p>
                    </div>
                    <div style={styles.card}>
                        <strong>Booked Slots:</strong> {bookedCount} / {totalSlots}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.controls}>
                        <div>
                            <label style={styles.label}>View Mode</label>
                            <select
                                style={styles.input}
                                value={viewMode}
                                onChange={(e) => {
                                    if (e.target.value === "admin" && !isAdmin) {
                                        setMessage("Enter the admin password to edit the schedule.");
                                        return;
                                    }
                                    setViewMode(e.target.value);
                                }}
                            >
                                {isAdmin && <option value="admin">Admin View</option>}
                                <option value="therapist">Therapist View</option>
                            </select>
                        </div>

                        <div>
                            <label style={styles.label}>Admin Access</label>
                            {isAdmin ? (
                                <button style={styles.dangerButton} onClick={logoutAdmin}>Logout Admin</button>
                            ) : (
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        style={styles.input}
                                        type="password"
                                        placeholder="Admin password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && loginAdmin()}
                                    />
                                    <button style={styles.primaryButton} onClick={loginAdmin}>Login</button>
                                </div>
                            )}
                        </div>

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

                        {isAdmin && viewMode === "admin" && (
                            <>
                                <div>
                                    <label style={styles.label}>Add / Remove Therapist</label>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input style={styles.input} placeholder="Enter therapist name" value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTherapist()} />
                                        <button style={styles.primaryButton} onClick={addTherapist}>Add</button>
                                    </div>
                                    <button style={{ ...styles.dangerButton, marginTop: 8 }} onClick={removeTherapist}>Remove Selected Therapist</button>
                                </div>

                                <div>
                                    <label style={styles.label}>Clear Schedule</label>
                                    <button style={styles.dangerButton} onClick={clearDay}>Clear Date</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {message && <div style={styles.card}>{message}</div>}

                {viewMode === "therapist" && (
                    <div style={styles.card}>
                        <h2 style={{ marginTop: 0 }}>{selectedTherapist}'s Assignments</h2>
                        {mySchedule.length === 0 ? (
                            <p>No room assignments found for this therapist on this date.</p>
                        ) : (
                            <ul>
                                {mySchedule.map((item) => (
                                    <li key={item.key}><strong>{item.time}</strong> — {item.room}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

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
                                                        {isAdmin && viewMode === "admin" && (
                                                            <button style={{ ...styles.button, marginTop: 8, padding: "6px 8px" }} onClick={() => clearSlot(room, time)}>Clear</button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    isAdmin && viewMode === "admin" ? (
                                                        <button style={{ ...styles.button, width: "100%", minHeight: 56 }} onClick={() => assignRoom(room, time)}>Assign</button>
                                                    ) : (
                                                        <div style={{ color: "#9ca3af", textAlign: "center", paddingTop: 18 }}>Open</div>
                                                    )
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p style={styles.note}>Privacy note: Do not enter client names, diagnoses, or appointment details. Use therapist name, room, date, and time only unless you build this with HIPAA-compliant safeguards.</p>
            </div>
        </div>
    );
}
