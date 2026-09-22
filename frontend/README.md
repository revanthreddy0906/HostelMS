# HMS Frontend

React + TypeScript + Vite + Tailwind CSS single-page app for the Hostel
Management System. Calls the FastAPI backend at `hms/api/main.py` for all
data -- see the repository root `README.md` for how to run both servers
together, and `docs/TRACEABILITY_MATRIX.md` for the full FR -> API endpoint
-> page mapping.

## Development

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api/* to http://localhost:8000
npm run build    # production build, type-checked with tsc
```

## Structure

- `src/api/` -- typed fetch client (`client.ts`) and one function group per
  backend module (`endpoints.ts`).
- `src/components/` -- the shared design-system components (Button, Card,
  Table, Modal, Badge, form fields, Sidebar, layout, toasts).
- `src/context/` -- `AuthContext` (JWT + current user) and `ToastContext`.
- `src/pages/` -- one page per SRS module (Students, Hostels & Rooms,
  Allocations, Fees, Complaints, Visitors, Attendance, Leaves & Gate Pass,
  Reports, Staff), plus Login/403/404.
