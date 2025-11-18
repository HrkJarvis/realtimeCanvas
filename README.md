# Realtime Collaborative Canvas

A simple Excalidraw-inspired realtime collaborative whiteboard built with **React (Vite)**, **MUI**, and a **Node.js + Express + Socket.io** backend. No auth required: anyone with the room link can join and draw together.

## Features

- **Infinite-feeling canvas** with panning (middle/right mouse or Shift+drag) and scroll-to-zoom.
- **Tools**:
  - Pen (freehand)
  - Rectangle
  - Ellipse
- **Styling controls**:
  - Color picker
  - Stroke width slider
- **Realtime collaboration** via Socket.io:
  - Shareable room URLs (e.g. `/room/abc123`)
  - All strokes/shapes sync in near realtime.
- **Per-user undo/redo**:
  - Undo/redo only affects the actions you created on this client.
  - Other users' drawings are never undone by your undo.
- No authentication: open a link and start drawing.

> Note: This project is **inspired by** Excalidraw but not a copy. It implements a smaller feature set focusing on the assignment requirements.

---

## Project Structure

```text
canvas/
  server/        # Node.js + Express + Socket.io backend
  client/        # Vite + React + MUI frontend
  PROMPTS.md     # Log of AI-assisted prompts
  README.md      # This file
```

---

## Installation

### Prerequisites

- Node.js (LTS recommended)
- npm (comes with Node)

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Install Client Dependencies

```bash
cd client
npm install
```

---

## How to Run Locally

### 1. Start the Backend Server

```bash
cd server
npm run dev        # Development mode with nodemon
# OR
npm start          # Production mode
```

The server will start on `http://localhost:4000` (or custom PORT if set).

### 2. Start the Frontend Client

```bash
cd client
npm run dev        # Starts Vite dev server
```

The client will start on `http://localhost:5173`.

### 3. Access the Application

Open your browser and navigate to `http://localhost:5173` to use the application.

---

## Environment Variables / Services Required

### Required Services

- **Node.js Runtime**: Required for both client and server
- **No external databases**: The application uses in-memory storage for room data

### Optional Environment Variables

- `PORT` (server): Server port number (default: `4000`)
  
  To set a custom port:
  ```bash
  cd server
  PORT=3000 npm run dev
  ```

### Default Configuration

- **Server Port**: 4000
- **Client Port**: 5173 (Vite default)
- **CORS Origin**: `http://localhost:5173` (configured in server)
- **Room Persistence**: In-memory only (rooms are lost when server restarts)

---

## How to Use

1. **Open Home Page**  
   Go to `http://localhost:5173/`.

2. **Create a Room**  
   Click **"Create New Room"**. You will be taken to a URL like:
   
   ```text
   http://localhost:5173/room/abcd1234
   ```

3. **Share the Room**  
   In the room header, click the **copy icon** to copy the shareable URL to clipboard.  
   Send this link to anyone; they can open it to join the same canvas.

4. **Join a Room by ID**  
   On the home page, paste the room ID (the text after `/room/`) into the **Room ID** field and click **"Join Room"**.

5. **Drawing & Navigation**
   - Select tool in the toolbar: **Pen**, **Rect**, or **Ellipse**.
   - Pick a **color** and **stroke width**.
   - **Draw** by left-click dragging on the canvas.
   - **Pan** by:
     - Using middle mouse button, or
     - Right mouse button, or
     - Holding **Shift** and dragging.
   - **Zoom** with mouse wheel (scroll in/out).

6. **Undo / Redo**
   - Use **Undo** / **Redo** buttons in the toolbar.
   - Undo/redo only affects actions created in this browser tab (per-user history).
   - Other users' drawings will remain intact.

---

## Implementation Notes

### Backend

- Built with **Express** and **Socket.io**.
- Maintains in-memory state per room:
  - `elements`: map of element IDs to shape/stroke data.
  - `users`: connected users in the room.
- Events:
  - `join-room`: join a specific room ID.
  - `room-init`: server sends current room elements to a new user.
  - `canvas-event`: add/update/delete elements, broadcast to room.
  - `cursor-move` (optional extension): broadcast cursor positions.
- Rooms persist **as long as at least one user is connected**.

### Frontend

- **React + Vite** app with **MUI** for UI components.
- Uses **React Router** for:
  - `/` – Home page (create/join room).
  - `/room/:roomId` – Canvas page.
- `CanvasBoard` component:
  - Maintains local `elements` array.
  - Connects to Socket.io client.
  - Handles drawing logic for pen/rect/ellipse.
  - Applies camera transforms for panning/zoom.
  - Tracks per-user action history in-memory for undo/redo.

### Per-User Undo/Redo

- Each browser tab has its own `undoStack` / `redoStack`.
- When you add an element:
  - It is pushed to your **undo stack**.
  - A corresponding `canvas-event` is emitted.
- Undo will:
  - Remove your element locally.
  - Emit a delete event for that element.
- Since user IDs are embedded in element IDs, histories remain scoped to actions created in this client.

---

## AI / PROMPTS

See `PROMPTS.md` for a log of AI-assisted prompts and conversations that contributed to this project.

---

## Future Improvements / Ideas

- Add text tool, arrows, and more shapes.
- Show live cursors and user labels.
- Better selection/move/resize for existing elements.
- Persist rooms in a database instead of in-memory.
- Optimize rendering for a very large number of elements.
