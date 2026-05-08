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
  Logo setup:
  1. Create a folder named public in your project if it does not already exist.
  2. Save the Shield Bearer logo image as: public/shieldbearer-logo.png
  3. The app will display it automatically.

  Firebase setup:
  Replace the firebaseConfig below with your own Firebase web app config.
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

const DEFAULT_ROOMS = ["Art Room", ...Array.from({ length: 11 }, (_, i) => `${i + 1}`)];

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

const COLORS = [
    "#e8f5d9",
    "#eee1ff",
    "#dbeeff",
    "#fff1bd",
    "#ffddea",
    "#e3e9ff",
    "#dff7ef",
    "#fde2d2",
];

function makeSafeId(text) {
    return text.replace(/[^a-zA-Z0-9]/g, "_");
}

function therapistColor(name) {
    let total = 0;
    for (let i = 0; i < name.length; i++) total += name.charCodeAt(i);
    return COLORS[total % COLORS.length];
}

export default function App() {
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [rooms, setRooms] = useState(DEFAULT_ROOMS);
    const [newRoom, setNewRoom] = useState("");
    const [therapists, setTherapists] = useState(DEFAULT_THERAPISTS);
    const [newTherapist, setNewTherapist] = useState("");
    const [selectedTherapist, setSelectedTherapist] = useState(DEFAULT_THERAPISTS[0]);
    const [assignments, setAssignments] = useState({});
    const [message, setMessage] = useState("Connecting to shared schedule...");
    const [viewMode, setViewMode] = useState("therapist");
    const [adminPassword, setAdminPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [roomFilter, setRoomFilter] = useState("all");

    // Simple temporary password. Change this to whatever you want.
    // For stronger security later, use Firebase Authentication instead.
    const ADMIN_PASSWORD = "shieldbearer123";

    const dateAssignments = assignments[selectedDate] || {};
    const visibleRooms = roomFilter === "all" ? rooms : rooms.filter((room) => room === roomFilter);
    const bookedCount = useMemo(() => Object.keys(dateAssignments).length, [dateAssignments]);
    const totalSlots = rooms.length * TIME_SLOTS.length;

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
        const roomsRef = collection(db, "rooms");

        const unsubscribe = onSnapshot(roomsRef, async (snapshot) => {
            if (snapshot.empty) {
                await Promise.all(
                    DEFAULT_ROOMS.map((room, index) =>
                        setDoc(doc(db, "rooms", makeSafeId(room)), { name: room, order: index })
                    )
                );
                return;
            }

            const liveRooms = [];
            snapshot.forEach((document) => liveRooms.push(document.data()));
            liveRooms.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));
            setRooms(liveRooms.map((room) => room.name));
        });

        return () => unsubscribe();
    }, []);

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

    function therapistAlreadyBooked(time, therapist) {
        return Object.entries(dateAssignments).some(([key, value]) => {
            const expectedTimePart = makeSafeId(time);
            return key.endsWith(`__${expectedTimePart}`) && value === therapist;
        });
    }

    async function assignRoom(room, time) {
        if (!isAdmin) {
            setMessage("Enter the admin password to edit the schedule.");
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
            setMessage("Enter the admin password to edit the schedule.");
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
            setMessage("Enter the admin password to remove therapists.");
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
        const removedName = selectedTherapist;
        setSelectedTherapist(remainingTherapists[0] || "");
        setMessage(`${removedName} removed from the shared therapist list.`);
    }

    async function addRoom() {
        if (!isAdmin) {
            setMessage("Enter the admin password to add rooms.");
            return;
        }

        const roomName = newRoom.trim();
        if (!roomName) return;

        if (rooms.includes(roomName)) {
            setMessage("That room is already in the list.");
            return;
        }

        await setDoc(doc(db, "rooms", makeSafeId(roomName)), {
            name: roomName,
            order: rooms.length,
        });

        setNewRoom("");
        setMessage(`${roomName} added to the room list.`);
    }

    async function clearDay() {
        if (!isAdmin) {
            setMessage("Enter the admin password to edit the schedule.");
            return;
        }

        const confirmed = window.confirm("Clear all room assignments for this date?");
        if (!confirmed) return;

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
                const room = rooms.find((r) => key.startsWith(makeSafeId(r)));
                const time = TIME_SLOTS.find((t) => key.endsWith(makeSafeId(t)));
                return { key, therapist, room, time };
            })
            .filter((item) => item.therapist === selectedTherapist)
            .sort((a, b) => TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time));
    }

    const styles = {
        page: {
            minHeight: "100vh",
            background: "linear-gradient(180deg, #fbf9ff 0%, #ffffff 45%, #f7f4fb 100%)",
            padding: 24,
            fontFamily: "Inter, Arial, sans-serif",
            color: "#171321",
        },
        header: {
            display: "grid",
            gridTemplateColumns: "280px 1fr 230px",
            gap: 24,
            alignItems: "center",
            maxWidth: 1600,
            margin: "0 auto 24px auto",
        },
        logo: { width: 260, maxWidth: "100%", objectFit: "contain" },
        titleArea: { textAlign: "center" },
        title: { margin: 0, color: "#4b136c", fontSize: 38, letterSpacing: 1, fontWeight: 900 },
        subtitle: { margin: "12px 0 0 0", color: "#5b5f71", fontSize: 18, fontWeight: 600 },
        adminBox: {
            background: "#ffffff",
            border: "1px solid #e5dff0",
            borderRadius: 12,
            padding: 14,
            boxShadow: "0 8px 22px rgba(75, 19, 108, 0.08)",
        },
        adminStatus: { display: "flex", alignItems: "center", gap: 8, color: isAdmin ? "#15803d" : "#6b7280", fontWeight: 900 },
        adminSmall: { fontSize: 12, marginTop: 6, color: "#111827" },
        shell: { maxWidth: 1600, margin: "0 auto" },
        card: {
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #e7e0ef",
            borderRadius: 12,
            padding: 18,
            boxShadow: "0 8px 22px rgba(75, 19, 108, 0.07)",
            marginBottom: 18,
        },
        controls: { display: "grid", gridTemplateColumns: "repeat(5, minmax(190px, 1fr))", gap: 18, alignItems: "end" },
        label: { display: "block", fontSize: 13, fontWeight: 900, marginBottom: 8, color: "#111827" },
        input: {
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 13px",
            borderRadius: 8,
            border: "1px solid #d8d3e3",
            background: "#ffffff",
            fontSize: 14,
            outlineColor: "#6b21a8",
        },
        button: {
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid #d8d3e3",
            background: "#ffffff",
            color: "#4b136c",
            cursor: "pointer",
            fontWeight: 900,
            boxShadow: "0 2px 8px rgba(75,19,108,0.06)",
        },
        primaryButton: {
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #6b21a8, #4b136c)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            boxShadow: "0 8px 16px rgba(75, 19, 108, 0.2)",
        },
        dangerButton: {
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #ef4444",
            background: "#ffffff",
            color: "#dc2626",
            cursor: "pointer",
            fontWeight: 900,
        },
        tableWrap: {
            overflowX: "auto",
            background: "white",
            borderRadius: 12,
            border: "1px solid #e7e0ef",
            boxShadow: "0 8px 22px rgba(75, 19, 108, 0.07)",
        },
        table: { width: "100%", minWidth: 1250, borderCollapse: "separate", borderSpacing: 0 },
        th: {
            background: "#fbfaff",
            padding: "16px 10px",
            textAlign: "center",
            borderBottom: "1px solid #e7e0ef",
            borderRight: "1px solid #f1edf7",
            fontWeight: 900,
            color: "#171321",
            whiteSpace: "nowrap",
        },
        timeCell: {
            padding: 14,
            borderBottom: "1px solid #f1edf7",
            borderRight: "1px solid #f1edf7",
            fontWeight: 800,
            background: "#ffffff",
            textAlign: "center",
            width: 105,
            whiteSpace: "nowrap",
        },
        td: {
            padding: 6,
            borderBottom: "1px solid #f1edf7",
            borderRight: "1px solid #f1edf7",
            verticalAlign: "top",
            background: "#ffffff",
        },
        slotButton: {
            width: "100%",
            minHeight: 44,
            borderRadius: 8,
            border: "1px solid #e5e0ec",
            background: "linear-gradient(180deg, #ffffff, #fbfaff)",
            color: "#5b3b7a",
            fontSize: 22,
            cursor: "pointer",
        },
        assignment: {
            minHeight: 44,
            borderRadius: 8,
            padding: "8px 10px",
            border: "1px solid rgba(75,19,108,0.12)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontWeight: 900,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)",
        },
        assignmentSmall: { fontSize: 11, color: "#4b5563", marginTop: 2, fontWeight: 700 },
        bottomGrid: { display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 18, marginTop: 18 },
        sectionTitle: { color: "#4b136c", fontWeight: 900, margin: "0 0 14px 0", fontSize: 16 },
        chipWrap: { display: "flex", gap: 8, flexWrap: "wrap" },
        chip: { border: "1px solid #d8d3e3", background: "#fbfaff", borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 13 },
        message: { color: "#4b136c", fontWeight: 800 },
        note: { color: "#6b7280", fontSize: 12, lineHeight: 1.5, marginTop: 14 },
    };

    const mySchedule = therapistSchedule();

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <img
                        src="/shieldbearer-logo.png"
                        alt="Shield Bearer logo"
                        style={styles.logo}
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                </div>

                <div style={styles.titleArea}>
                    <h1 style={styles.title}>ROOM ASSIGNMENTS</h1>
                    <p style={styles.subtitle}>Manage therapist room assignments by time</p>
                </div>

                <div style={styles.adminBox}>
                    <div style={styles.adminStatus}>{isAdmin ? "🔒 Admin Mode" : "👁️ Therapist View"}</div>
                    <div style={styles.adminSmall}>{isAdmin ? "You are logged in as admin" : "Read-only access"}</div>
                    {isAdmin ? (
                        <button style={{ ...styles.dangerButton, marginTop: 12, width: "100%" }} onClick={logoutAdmin}>Logout</button>
                    ) : (
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
            </header>

            <main style={styles.shell}>
                <section style={styles.card}>
                    <div style={styles.controls}>
                        <div>
                            <label style={styles.label}>Select Date</label>
                            <input style={styles.input} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        </div>

                        <div>
                            <label style={styles.label}>Therapist</label>
                            <select style={styles.input} value={selectedTherapist} onChange={(e) => setSelectedTherapist(e.target.value)}>
                                {therapists.map((therapist) => <option key={therapist} value={therapist}>{therapist}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={styles.label}>Mode</label>
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
                            <label style={styles.label}>View</label>
                            <select style={styles.input} value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
                                <option value="all">All Rooms</option>
                                {rooms.map((room) => <option key={room} value={room}>{room}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={styles.label}>Booked Slots</label>
                            <div style={{ ...styles.input, fontWeight: 900, color: "#4b136c", background: "#fbfaff" }}>{bookedCount} / {totalSlots}</div>
                        </div>
                    </div>

                    {isAdmin && viewMode === "admin" && (
                        <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
                            <button style={styles.primaryButton} onClick={() => setMessage("Select a therapist, then click a plus sign in the schedule grid.")}>＋ Assign Room</button>
                            <button style={styles.dangerButton} onClick={clearDay}>🗑 Clear All Rooms</button>
                        </div>
                    )}
                </section>

                {message && <section style={{ ...styles.card, ...styles.message }}>{message}</section>}

                {viewMode === "therapist" && (
                    <section style={styles.card}>
                        <h2 style={styles.sectionTitle}>{selectedTherapist}'s Assignments</h2>
                        {mySchedule.length === 0 ? (
                            <p style={{ margin: 0 }}>No room assignments found for this therapist on this date.</p>
                        ) : (
                            <div style={styles.chipWrap}>
                                {mySchedule.map((item) => (
                                    <div key={item.key} style={styles.chip}><strong>{item.time}</strong> — {item.room}</div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                <section style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Time</th>
                                {visibleRooms.map((room) => <th key={room} style={styles.th}>{room}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {TIME_SLOTS.map((time) => (
                                <tr key={time}>
                                    <td style={styles.timeCell}>{time}</td>
                                    {visibleRooms.map((room) => {
                                        const key = slotKey(room, time);
                                        const assigned = dateAssignments[key];
                                        return (
                                            <td key={key} style={styles.td}>
                                                {assigned ? (
                                                    <div style={{ ...styles.assignment, background: therapistColor(assigned) }} onClick={() => isAdmin && clearSlot(room, time)} title={isAdmin ? "Click to clear this slot" : "Assigned"}>
                                                        <div>{assigned}</div>
                                                        <div style={styles.assignmentSmall}>{room} • {time}</div>
                                                    </div>
                                                ) : (
                                                    isAdmin && viewMode === "admin" ? (
                                                        <button style={styles.slotButton} onClick={() => assignRoom(room, time)} title="Assign selected therapist">+</button>
                                                    ) : (
                                                        <div style={{ ...styles.slotButton, cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", color: "#c5b9d3" }}>+</div>
                                                    )
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {isAdmin && viewMode === "admin" && (
                    <section style={styles.bottomGrid}>
                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>ROOM MANAGEMENT</h3>
                            <label style={styles.label}>Add New Room</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input style={styles.input} placeholder="Enter room name, e.g., Room 12" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoom()} />
                                <button style={styles.primaryButton} onClick={addRoom}>Add Room</button>
                            </div>
                        </div>

                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>CURRENT ROOMS</h3>
                            <div style={styles.chipWrap}>
                                {rooms.map((room) => <span key={room} style={styles.chip}>{room}</span>)}
                            </div>
                        </div>

                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>THERAPIST MANAGEMENT</h3>
                            <label style={styles.label}>Add / Remove Therapist</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input style={styles.input} placeholder="Enter therapist name" value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTherapist()} />
                                <button style={styles.primaryButton} onClick={addTherapist}>Add</button>
                            </div>
                            <button style={{ ...styles.dangerButton, marginTop: 10, width: "100%" }} onClick={removeTherapist}>Remove Selected Therapist</button>
                        </div>
                    </section>
                )}

                <section style={styles.card}>
                    <h3 style={styles.sectionTitle}>How to use</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                        <li>Select a therapist, then click “+” to assign that therapist to a room.</li>
                        <li>Click an assigned slot in Admin Mode to clear that assignment.</li>
                        <li>Use “Clear All Rooms” to clear the entire day.</li>
                        <li>Do not enter client names, diagnoses, notes, or PHI.</li>
                    </ul>
                </section>
            </main>
        </div>
    );
}
