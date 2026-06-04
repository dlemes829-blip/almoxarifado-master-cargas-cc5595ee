# Master Cargas Brasil - Almoxarifado

## Overview
Inventory management (almoxarifado) system for Master Cargas Brasil. Full-stack TypeScript app with Express backend and React frontend.

## Architecture
- **Backend**: Express + TypeScript, PostgreSQL via Drizzle ORM
- **Frontend**: React + Vite, TanStack Query, Wouter routing, Tailwind CSS, Shadcn/UI, Framer Motion
- **Auth**: JWT-based with bcrypt password hashing
- **Real-time**: WebSocket for chat, notifications (sound + vibration), online user tracking, and live product updates
- **Reports**: jsPDF + jspdf-autotable for PDF, xlsx for Excel export
- **Barcode**: Cross-browser barcode scanning via `barcode-detector` polyfill (works on Chrome, Firefox, Safari, Edge)

## Theme System
- Light/Dark mode toggle implemented via CSS variables in `index.css`
- `:root` contains light theme variables, `.dark` class contains dark theme variables
- `ThemeContext` in `client/src/hooks/use-theme.ts` manages state, persists to localStorage
- Login page always forces dark mode (black background)

## Key Files
- `shared/schema.ts` - Drizzle ORM schema (users, products, movements, history, responsaveis)
- `shared/routes.ts` - API route definitions with Zod validation (includes categoryBreakdown, lowStockList, rankingList in dashboard schema)
- `server/routes.ts` - Express route handlers with WebSocket broadcast + online user tracking + chat history
- `server/storage.ts` - Storage interface and database implementation
- `client/src/App.tsx` - Router and providers
- `client/src/components/layout/AppLayout.tsx` - Main layout with sidebar nav + top bar (user info, theme toggle, logout)
- `client/src/components/ChangePasswordModal.tsx` - Password change dialog (forced on first login)
- `client/src/hooks/use-theme.ts` - Theme provider hook
- `client/src/hooks/use-websocket.ts` - WebSocket context provider with sound/vibration notifications + online users
- `client/src/hooks/use-responsaveis.ts` - Responsáveis CRUD hooks

## Database Tables
- `users` - User accounts with granular permissions and `cargo` field
- `products` - Inventory items with barcode, category, stock levels (433 products imported)
- `movements` - Stock entries/exits with `responsavel_id` for exits
- `history` - Audit trail of all system actions with `modulo` column
- `responsaveis` - Responsible persons (nome, setor) for product withdrawals

## Layout
- **Sidebar**: Navigation links only (Painel, Produtos, Movimentações, Histórico, Solicitações, Relatórios, Bate Papo, Usuários)
- **Top Bar**: EN button (development toast), theme toggle (sun/moon icon), change password (key icon), user avatar + name + cargo, logout button
- **Mobile**: Hamburger menu opens sidebar sheet, top bar visible on all screens
- **Branding**: "Master" (accent, non-italic) + "Cargas" (foreground) + "Brasil" subtitle + "Transporte · Logística · Serviços"

## Pages
- `/login` - Authentication (always black/dark)
- `/` - Dashboard: greeting, online users bar, stat cards, RANKING at TOP (Classificação ADM), Atividade Geral (today's history, resets at 00:00), Atividade de Hoje, category breakdown + Resumo de Movimentações, LOW STOCK at BOTTOM (Produtos com Risco de Falta)
- `/produtos` - Products management (CRUD) with barcode scanner inside "Novo Produto" dialog, per-product entry dialog, category tabs, stock filters, grid/table view toggle. Labels use "Estoque Mínimo" with accent.
- `/movimentacoes` - "SAÍDA MATERIAIS" / "ENTRADA MATERIAIS" toggle with product search, barcode scanning, responsible person selection (exits), "OBSERVAÇÃO" label with accent
- `/historico` - "Histórico de Fluxo" with two tabs: Status de Movimento por Usuários (user stats + audit log with color-coded module badges) and Fluxo de Estoque (filters + date-grouped movement cards). Module filter dropdown included.
- `/solicitacoes` - Material requests with TWO modes: "Solicitar Materiais" (internal, green) with sector-based spreadsheet (RECEP., PORTA., AZ1, AZ2, DAF columns); and "Solicitar p/ Fornecedor" (blue) with supplier restock table (Est. Atual, Est. Mín., Qtd. Solicitar columns). Both modes have product chips with low stock highlight, auto-summing totals, editable message preview dialog with "Enviar ao Grupo", and zero-total guard. Bulk exit moved to chat (solicitação messages have "Baixar do Estoque" button for authorized users).
- `/relatorios` - Report generation (PDF/Excel): inventory, movements, low stock
- `/chat` - Group chat + DM support with sidebar, PT-BR date separators (Hoje/Ontem/full date), refined message bubbles, scroll-to-bottom button, online indicators
- `/usuarios` - User management with table layout, Responsáveis tab, Cargo field. Labels use "permissões", "usuário" with accents.

## Key Features
- **Entries**: Registered via Products page (per-product entry dialog with quantity + observação) or Movements ENTRADA tab
- **Exits**: Registered via Movements page SAÍDA tab (with responsible person and barcode scanner)
- **Barcode scanning**: Camera-based via BarcodeDetector API - search scanner on Products main page, form scanner inside Novo Produto dialog, scanner on Movements page
- **Online users**: WebSocket-based tracking displayed on Dashboard top bar with real-time status
- **Chat**: Group "Geral Almoxarifado" + DM chat with WebSocket, photo upload (multer, /uploads/), read receipts (blue checkmarks), solicitação message bulk exit button, server stores last 200 messages in memory, sends history after identify, PT-BR date separators
- **Dashboard ranking**: Shows user ranking by TODAY's movements (resets at 00:00), card-based layout with gold/silver/bronze medals, progress bars
- **Force Logout**: Admin can kick all users (POST /api/admin/kick-all), shows animated "Sessão Encerrada" screen
- **Unread Badge**: Red pulsing badge on "Bater Papo" sidebar link when there are unread messages and user is not on /chat page
- **Audit log**: History page shows color-coded module badges (Auth=blue, Produtos=green, Movimentações=orange, Usuários=purple, Sistema=cyan)
- **Dashboard ranking celebration**: When current user is #1 in ranking, shows animated trophy banner with vibration on dashboard load
- Product edits (including quantity changes) log to history AND broadcast WebSocket notification with sound/vibration
- Product quantity is editable via Products page edit dialog
- Dashboard "Atividade Geral" shows ALL today's history entries (logins, product edits, movements, user changes) and resets daily at 00:00
- Movement creation schema allows optional usuario_id (set server-side), optional responsavel_id and observacao
- **Login notification**: Backend broadcasts login notifications to all connected users
- Force password change on first login (must_change_password flag)
- Responsáveis management for product exit tracking
- Material request system with sector-based spreadsheet, message preview/edit before sending to chat
- PDF/Excel report generation for inventory, movements, and low stock
- Bulk product import via POST /api/products/bulk-import

## User Permissions
Each user has granular permissions: `pode_ver_dashboard`, `pode_ver_produtos`, `pode_registrar_entrada`, `pode_registrar_saida`, `pode_ver_historico`, `pode_ver_chat`, `pode_exportar_relatorio`, `pode_gerenciar_usuarios`

## Default User
- Username: DEV, Password: 120605 (full admin access)

## Important Notes
- All DialogContent components have DialogDescription to avoid Radix accessibility warnings
- `Key` icon from lucide-react doesn't exist - use `KeyRound` instead
- Default user has `must_change_password: false` so no forced password change
- New users created with `must_change_password: true` by default
- WebSocket uses context provider pattern (single connection in AppLayout, shared via WebSocketContext)
- All events broadcast notifications with sound + vibration: login, user CRUD, product CRUD, movements, chat messages, report generation, solicitações, responsável CRUD
- Self-notification suppression for chat messages, reports, and solicitações
- Low stock dashboard shows products with estoque_minimo > 0 AND quantidade_atual <= estoque_minimo, plus all zero-stock products (up to 50 items)
- Dashboard stat cards use explicit Tailwind class strings (not dynamic interpolation) to ensure proper compilation
- Products form scanner has race condition guard: checks isDialogOpen before attaching stream
- All scanner start functions call stop first to prevent duplicate intervals/timeouts
- WebSocket reconnection timer is tracked and cleared before rescheduling to prevent timer stacking
- All setTimeout/setInterval refs are tracked and cleaned up on unmount (scannerTimeoutRef, formScannerTimeoutRef, etc.)
- Solicitações prevents sending when all row totals are zero
- EN button in header shows "FUNÇÃO EM DESENVOLVIMENTO, ATT DEV" toast
- Products page has delete functionality with confirmation dialog
- Categories: LIMPEZA, ADMINISTRATIVO, ALIMENTOS, MANUTENÇÃO PREDIAL, MANUTENÇÃO, EPI, DAF, OUTROS
- ProtectedRoute enforces page-level permissions (blocks direct URL access for unauthorized users)
- Barcode scanner uses `barcode-detector` polyfill via `client/src/lib/barcode-scanner.ts` utility (cross-browser)
- Scanner helper functions: `detectBarcode(source)` and `getCamera()` with automatic fallback for camera constraints
- TypeScript compiles cleanly with zero errors (all Map/Set iterators use Array.from, all type assertions handled)
- initDb() has .catch() error handler for startup safety
- All Portuguese text uses proper accents (ã, ç, í, é, ê, ó, etc.)
