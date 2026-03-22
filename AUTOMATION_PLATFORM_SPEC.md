# FlowForge — AI-Powered Automation Platform

## AUTOMATION PLATFORM SPEC -- Implementation Plan

### 1. Product Vision and Market Differentiation

**Product Name:** FlowForge (working name -- white-labelable)

**Vision:** A white-label, AI-powered automation builder platform that can be embedded into or offered alongside any SaaS product. Users describe what they want in plain English; the AI generates, tests, and deploys n8n-backed workflows through a visual drag-and-drop interface.

**Market Differentiation:**
- Unlike Zapier/Make: This is white-labelable -- each customer's SaaS product gets its own branded automation builder.
- Unlike raw n8n: End users never see n8n. The platform abstracts it behind an AI chat interface and visual builder.
- Unlike custom-coded integrations: AI generates the workflows from natural language, lowering the barrier to zero-code automation.
- Multi-AI model support (OpenAI + Grok) gives flexibility and fallback capability.

**Target Users:**
- SaaS product owners who want to offer automation features to their users.
- End users of those SaaS products who want to automate repetitive tasks.
- Teams that need to create custom workflows without developer assistance.

---

### 2. Architecture Decisions

**2.1 Database: PostgreSQL + Prisma ORM**

The current file-based storage (JSON, CSV, Markdown files in `DATA_DIR`) must be replaced with PostgreSQL for multi-tenancy, ACID transactions, and scalability. Prisma provides type-safe queries that align with the existing TypeScript codebase.

The current approach reads files like `reddit-matches.json`, `content-queue.md`, `directories.md`, and `daily-metrics.csv` from the filesystem via `fs.readFile`. This cannot scale to multiple tenants or support concurrent writes safely.

**2.2 Authentication: NextAuth.js v5 (Auth.js)**

Add `next-auth@5` with credential, Google, and GitHub providers. This integrates natively with the Next.js 16 App Router. Sessions stored in the database via Prisma adapter. JWT-based API authentication for external integrations.

**2.3 Multi-Tenancy Model: Organization-Based**

Every entity (workflow, execution, template, API key) belongs to an `Organization`. Users are members of organizations with roles (owner, admin, member). The n8n backend is shared but workflows are tagged and namespaced by organization ID.

**2.4 n8n Interaction Pattern**

Keep n8n as the execution engine. The platform creates, updates, and manages n8n workflows programmatically via the n8n REST API (already used in `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/n8n.ts`). The visual builder generates n8n-compatible workflow JSON. The AI generates n8n node configurations from natural language.

---

### 3. Feature List with Priority Tiers

**MVP (Weeks 1-6):**
1. Database migration from file-based to PostgreSQL
2. Authentication and user management (NextAuth.js v5)
3. Organization/tenant management
4. Generic workflow CRUD (create, read, update, delete workflows via n8n API)
5. AI Chat interface for workflow generation (OpenAI + Grok)
6. Basic visual workflow builder (view and arrange nodes)
7. Workflow templates library (pre-built templates replacing hardcoded ForgeCadNeo configs)
8. Generic trigger/action/condition primitives
9. White-label theming system (extend current Obsidian Forge theme to be configurable)
10. Execution history and basic monitoring

**V2 (Weeks 7-12):**
1. Full drag-and-drop visual workflow builder with node editing
2. Workflow testing sandbox (dry-run with mock data)
3. Advanced AI capabilities (workflow optimization suggestions, error diagnosis)
4. Webhook management UI
5. Credential vault (securely store API keys for integrations)
6. Workflow versioning and rollback
7. Notification system (email, in-app, webhook on execution events)
8. Usage analytics and billing metering
9. Marketplace for shared workflow templates
10. Role-based access control with fine-grained permissions

**V3 (Weeks 13-20):**
1. Autonomous AI agents (long-running agents that monitor and react)
2. Multi-step AI conversations for complex workflow creation
3. Custom node/integration builder
4. API gateway for external access to workflows
5. Embeddable widget SDK (iframe/Web Component for embedding in other apps)
6. Batch operations and scheduling UI
7. Audit logging and compliance features
8. Performance analytics and SLA monitoring
9. White-label deployment automation (Terraform/Docker Compose per tenant)
10. Mobile-responsive workflow management

---

### 4. AI Integration Plan

**4.1 AI Service Abstraction Layer**

Create a unified AI service that supports multiple providers. The system will use OpenAI as the primary model and Grok (xAI) as a secondary/alternative.

```typescript
// New file: src/lib/ai/provider.ts
interface AIProvider {
  id: string;
  name: string;
  generateWorkflow(prompt: string, context: WorkflowContext): Promise<GeneratedWorkflow>;
  chat(messages: ChatMessage[], systemPrompt: string): Promise<string>;
  suggestFix(error: WorkflowError): Promise<string>;
}

interface WorkflowContext {
  availableNodes: NodeDefinition[];
  existingWorkflows: WorkflowSummary[];
  organizationIntegrations: Integration[];
}

interface GeneratedWorkflow {
  name: string;
  description: string;
  nodes: N8nNodeConfig[];
  connections: N8nConnection[];
  confidence: number;
  explanation: string;
}
```

**4.2 Workflow Generation via Chat**

The AI chat interface will:
1. Accept natural language descriptions ("Monitor Reddit for mentions of my product and post a summary to Slack every morning")
2. Parse intent and map to available n8n nodes
3. Generate a complete n8n workflow JSON
4. Present the workflow in the visual builder for review
5. Allow iterative refinement through follow-up messages
6. Deploy to n8n when the user approves

**System Prompt Template** (stored in `/src/lib/ai/prompts.ts`):
The system prompt will include the full catalog of available n8n nodes, the user's existing integrations, and examples of well-structured workflows. It will instruct the AI to output structured JSON matching the n8n workflow schema.

**4.3 AI-Powered Features:**
- **Workflow Generation:** Natural language to n8n workflow JSON
- **Error Diagnosis:** When a workflow execution fails, AI analyzes the error and suggests fixes
- **Optimization:** AI reviews existing workflows and suggests improvements
- **Documentation:** AI auto-generates documentation for workflows
- **Template Suggestions:** Based on user's integrations, AI suggests relevant templates

**4.4 API Key Management:**

New environment variables:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
GROK_API_KEY=xai-...
GROK_API_BASE_URL=https://api.x.ai/v1
GROK_MODEL=grok-3
AI_DEFAULT_PROVIDER=openai
```

---

### 5. Visual Workflow Builder Design

**5.1 Technology Choice: React Flow (reactflow)**

React Flow is the standard for building node-based editors in React. It integrates cleanly with the existing React 19 + shadcn/ui stack. Install: `@xyflow/react`.

**5.2 Node Types:**

The builder will have these visual node categories, each rendered as a custom React Flow node with the Obsidian Forge theme:

```typescript
// New file: src/types/workflow-builder.ts
type NodeCategory = 'trigger' | 'action' | 'condition' | 'transform' | 'output';

interface BuilderNode {
  id: string;
  type: NodeCategory;
  n8nType: string; // Maps to n8n node type, e.g., 'n8n-nodes-base.httpRequest'
  label: string;
  icon: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}
```

**5.3 Builder Layout:**

The workflow builder page (`/workflows/builder/[id]`) will have:
- **Left Panel:** Node palette (searchable catalog of available nodes grouped by category)
- **Center Canvas:** React Flow canvas with drag-and-drop nodes and connections
- **Right Panel:** Node configuration form (dynamically generated from node schema)
- **Top Bar:** Workflow name, save/deploy/test buttons, AI chat toggle
- **Bottom Bar:** Execution console / test output

**5.4 Bidirectional Sync with n8n:**

The visual builder operates on an internal representation (`BuilderWorkflow`) that is converted to/from n8n workflow JSON:

```typescript
// src/lib/workflow-builder/converter.ts
function builderToN8n(builderWorkflow: BuilderWorkflow): N8nWorkflowJSON { ... }
function n8nToBuilder(n8nWorkflow: N8nWorkflowJSON): BuilderWorkflow { ... }
```

---

### 6. Generic Automation Primitives

**6.1 Triggers** (what starts a workflow):

| Category | Examples |
|---|---|
| Schedule | Cron, interval, specific time |
| Webhook | HTTP POST/GET, custom URL |
| Event | Database change, file upload, API event |
| Integration | Email received, form submitted, message posted |
| Manual | Button click, API call |

**6.2 Actions** (what a workflow does):

| Category | Examples |
|---|---|
| HTTP | GET, POST, PUT, DELETE to any URL |
| Data | Transform, filter, merge, split |
| Integration | Send email, post to Slack, create ticket |
| Storage | Read/write database, file operations |
| AI | Generate text, classify, summarize |
| Code | Run JavaScript, Python snippets |

**6.3 Conditions** (branching logic):

| Type | Description |
|---|---|
| If/Else | Boolean condition on data |
| Switch | Multi-branch based on value |
| Filter | Include/exclude items |
| Error Handler | Try/catch for error handling |
| Loop | Iterate over arrays |

**6.4 Node Registry:**

```typescript
// New file: src/lib/nodes/registry.ts
interface NodeDefinition {
  id: string;
  type: NodeCategory;
  n8nNodeType: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  configSchema: JSONSchema;  // JSON Schema for the configuration form
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  tags: string[];
}

// Pre-populated registry mapping to n8n node types
const NODE_REGISTRY: NodeDefinition[] = [
  {
    id: 'http-request',
    type: 'action',
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    name: 'HTTP Request',
    description: 'Make HTTP requests to any URL',
    icon: 'Globe',
    color: '#60a5fa',
    configSchema: { /* ... */ },
    inputs: [{ name: 'main', type: 'main' }],
    outputs: [{ name: 'main', type: 'main' }],
    tags: ['http', 'api', 'web'],
  },
  // ... more nodes
];
```

---

### 7. Testing/Debugging/Monitoring Framework

**7.1 Workflow Testing Sandbox:**

A "Test Run" feature that executes the workflow in n8n with sample data and displays results node-by-node in the visual builder:

```typescript
// New API route: src/app/api/workflows/[id]/test/route.ts
// Sends a test execution to n8n with provided sample input
// Returns execution result with per-node output data
```

**7.2 Execution Debugger:**

Extend the current execution history (currently showing basic status) to include:
- Per-node execution data (input/output for each node)
- Execution timeline visualization
- Error highlighting on the visual builder canvas
- Re-run from failed node

**7.3 Monitoring Dashboard:**

Replace the current ForgeCadNeo-specific metrics dashboard with a generic workflow monitoring dashboard:
- Execution success/failure rates over time (reuse `MetricsLineChart` pattern from `src/components/charts/metrics-chart.tsx`)
- Average execution duration
- Most active workflows
- Error rate by workflow
- Real-time execution feed

**7.4 Alerts and Notifications:**

```typescript
// New file: src/lib/notifications/service.ts
interface AlertRule {
  id: string;
  workflowId: string;
  condition: 'execution_failed' | 'execution_slow' | 'execution_count_threshold';
  threshold?: number;
  channels: ('email' | 'in_app' | 'webhook')[];
}
```

---

### 8. White-Label/Multi-App Support

**8.1 Theming System:**

The current theme uses CSS custom properties (see `globals.css` lines 52-71: `--color-forge-*` variables). This is already well-structured for white-labeling.

Extend to support per-organization theme overrides:

```typescript
// New file: src/lib/theme/types.ts
interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    accent: string;      // Currently '#e8a23e'
    accentHover: string;
    secondary: string;   // Currently '#818cf8'
    success: string;
    error: string;
    warning: string;
    info: string;
    bgRoot: string;      // Currently '#050506'
    bgSurface: string;
    bgElevated: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    borderSubtle: string;
    borderDefault: string;
  };
  fonts: {
    sans: string;
    heading: string;
    mono: string;
  };
  logo?: {
    url: string;
    width: number;
    height: number;
  };
  brandName: string;     // Currently 'ForgeCadNeo'
  brandSubtitle: string; // Currently 'Automation'
}
```

**8.2 Theme Provider:**

A React context that injects CSS custom properties based on the organization's theme config. This replaces the hardcoded values in `globals.css` and the sidebar brand section in `src/components/layout/sidebar.tsx`.

**8.3 Multi-App Embedding:**

Each app that wants to offer automation gets:
- A unique `appId` and API key
- A customized theme
- A set of available integrations/nodes (node registry filtered by app)
- Optional: iframe-embeddable widget

---

### 9. File Structure and Code Organization

**Current structure** (to be preserved and extended):
```
src/
  app/
    api/
      content/queue/route.ts        # KEEP (move to legacy/ or plugin)
      directories/list/route.ts     # KEEP (move to legacy/ or plugin)
      metrics/daily/route.ts        # KEEP (refactor to generic)
      n8n/                          # KEEP (core n8n integration)
      reddit/                       # KEEP (move to plugin)
    content/page.tsx                # KEEP (move to plugin)
    directories/page.tsx            # KEEP (move to plugin)
    reddit/page.tsx                 # KEEP (move to plugin)
    workflows/page.tsx              # REFACTOR (generic workflow list)
    page.tsx                        # REFACTOR (generic dashboard)
    layout.tsx                      # REFACTOR (add auth, theme provider)
    providers.tsx                   # EXTEND (add auth, theme contexts)
    globals.css                     # REFACTOR (dynamic theme variables)
  components/
    charts/metrics-chart.tsx        # KEEP + EXTEND
    dashboard/kpi-card.tsx          # KEEP (already generic)
    layout/sidebar.tsx              # REFACTOR (dynamic nav, brand)
    ui/                             # KEEP (shadcn components)
  hooks/
    use-data.ts                     # REFACTOR (split into domain hooks)
  lib/
    n8n.ts                          # KEEP + EXTEND
    parsers.ts                      # KEEP (legacy compatibility)
    utils.ts                        # KEEP
  types/
    index.ts                        # REFACTOR (split into domain types)
```

**New structure to add:**
```
src/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
      forgot-password/page.tsx
    (dashboard)/
      layout.tsx                    # Authenticated layout with sidebar
      page.tsx                      # Generic overview dashboard
      workflows/
        page.tsx                    # Workflow list (refactored from existing)
        new/page.tsx                # New workflow (AI chat + template picker)
        [id]/
          page.tsx                  # Workflow detail/visual builder
          test/page.tsx             # Workflow test runner
          history/page.tsx          # Execution history for this workflow
      templates/
        page.tsx                    # Template marketplace
        [id]/page.tsx               # Template detail + use
      monitoring/
        page.tsx                    # Execution monitoring dashboard
      settings/
        page.tsx                    # Organization settings
        members/page.tsx            # Team management
        integrations/page.tsx       # API keys and integrations
        theme/page.tsx              # White-label theme editor
        billing/page.tsx            # Usage and billing
      plugins/                      # ForgeCadNeo-specific features as plugins
        reddit/page.tsx             # Moved from /reddit
        content/page.tsx            # Moved from /content
        directories/page.tsx        # Moved from /directories
    api/
      auth/[...nextauth]/route.ts   # NextAuth.js handler
      ai/
        chat/route.ts               # AI chat endpoint
        generate-workflow/route.ts  # Workflow generation endpoint
        suggest-fix/route.ts        # Error diagnosis endpoint
      workflows/
        route.ts                    # CRUD workflows
        [id]/
          route.ts                  # Single workflow CRUD
          test/route.ts             # Test execution
          deploy/route.ts           # Deploy to n8n
          history/route.ts          # Execution history
      templates/
        route.ts                    # Template CRUD
      organizations/
        route.ts                    # Org management
        [id]/
          members/route.ts          # Member management
          theme/route.ts            # Theme configuration
      integrations/
        route.ts                    # Integration management
      n8n/                          # Existing n8n API routes (kept)
        workflows/route.ts
        workflows/[id]/run/route.ts
        workflows/[id]/toggle/route.ts
        executions/route.ts
  components/
    ai/
      chat-panel.tsx                # AI chat sidebar/panel
      chat-message.tsx              # Individual chat message
      workflow-preview.tsx          # AI-generated workflow preview
    workflow-builder/
      canvas.tsx                    # React Flow canvas wrapper
      node-palette.tsx              # Left panel node catalog
      node-config-panel.tsx         # Right panel configuration
      custom-nodes/
        trigger-node.tsx            # Custom React Flow trigger node
        action-node.tsx             # Custom React Flow action node
        condition-node.tsx          # Custom React Flow condition node
        transform-node.tsx          # Custom React Flow transform node
      toolbar.tsx                   # Top toolbar (save, deploy, test)
      execution-console.tsx         # Bottom execution output panel
    monitoring/
      execution-timeline.tsx        # Timeline visualization
      execution-detail.tsx          # Per-node execution data
      metrics-dashboard.tsx         # Generic metrics charts
    templates/
      template-card.tsx             # Template card for marketplace
      template-preview.tsx          # Template detail preview
    settings/
      theme-editor.tsx              # Visual theme configuration
      member-list.tsx               # Team member management
    layout/
      sidebar.tsx                   # REFACTORED: dynamic nav, brand
      auth-guard.tsx                # Authentication wrapper
      theme-provider.tsx            # Dynamic theme injection
  hooks/
    use-data.ts                     # KEEP (legacy, gradually migrate)
    use-workflows.ts                # Workflow CRUD hooks
    use-ai-chat.ts                  # AI chat hooks
    use-executions.ts               # Execution monitoring hooks
    use-templates.ts                # Template hooks
    use-organization.ts             # Organization context hooks
    use-theme.ts                    # Theme hooks
  lib/
    ai/
      provider.ts                   # AI provider abstraction
      openai.ts                     # OpenAI implementation
      grok.ts                       # Grok (xAI) implementation
      prompts.ts                    # System prompts and templates
      workflow-generator.ts         # Prompt -> n8n workflow logic
    workflow-builder/
      converter.ts                  # Builder <-> n8n format conversion
      validator.ts                  # Workflow validation logic
      executor.ts                   # Test execution client
    nodes/
      registry.ts                   # Node type registry
      schemas/                      # JSON schemas for node configs
        http-request.ts
        schedule.ts
        webhook.ts
        code.ts
        if.ts
        switch.ts
        slack.ts
        email.ts
        # ... more
    auth/
      config.ts                     # NextAuth configuration
      middleware.ts                 # Auth middleware
    db/
      prisma.ts                     # Prisma client singleton
      schema.prisma                 # Database schema (in project root)
    theme/
      types.ts                      # Theme type definitions
      defaults.ts                   # Default themes
      generator.ts                  # CSS variable generator
    notifications/
      service.ts                    # Notification dispatch
    n8n.ts                          # KEEP + EXTEND
    parsers.ts                      # KEEP (legacy)
    utils.ts                        # KEEP
  types/
    index.ts                        # Legacy types (kept for compat)
    workflow.ts                     # Workflow domain types
    ai.ts                           # AI types
    organization.ts                 # Organization and user types
    builder.ts                      # Visual builder types
    template.ts                     # Template types

prisma/
  schema.prisma                     # Database schema
  migrations/                       # Database migrations
  seed.ts                           # Seed data (templates, default nodes)
```

---

### 10. Detailed Implementation Steps

**PHASE 1: Foundation (Weeks 1-2)**

**Step 1.1: Add PostgreSQL + Prisma**

Install dependencies:
```bash
npm install prisma @prisma/client
npm install -D prisma
npx prisma init
```

Create Prisma schema at `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  memberships   OrganizationMember[]
  aiChats       AIChat[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members    OrganizationMember[]
  workflows  Workflow[]
  templates  Template[]
  apiKeys    ApiKey[]
  theme      ThemeConfig?
  executions Execution[]
}

model OrganizationMember {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           MemberRole @default(MEMBER)
  createdAt      DateTime   @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model Workflow {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  description    String?
  n8nWorkflowId  String?  // ID in n8n instance
  status         WorkflowStatus @default(DRAFT)
  definition     Json     // Full workflow JSON (n8n format)
  version        Int      @default(1)
  isActive       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      String?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  executions   Execution[]
  versions     WorkflowVersion[]
  aiChats      AIChat[]
}

enum WorkflowStatus {
  DRAFT
  TESTING
  ACTIVE
  PAUSED
  ARCHIVED
}

model WorkflowVersion {
  id         String   @id @default(cuid())
  workflowId String
  version    Int
  definition Json
  changelog  String?
  createdAt  DateTime @default(now())
  createdBy  String?

  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
}

model Execution {
  id             String          @id @default(cuid())
  workflowId     String
  organizationId String
  n8nExecutionId String?
  status         ExecutionStatus @default(RUNNING)
  mode           String          @default("manual")
  startedAt      DateTime        @default(now())
  finishedAt     DateTime?
  duration       Int?            // milliseconds
  inputData      Json?
  outputData     Json?
  errorMessage   String?
  nodeResults    Json?           // Per-node execution results

  workflow     Workflow     @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

enum ExecutionStatus {
  RUNNING
  SUCCESS
  FAILED
  CANCELLED
  WAITING
}

model Template {
  id             String   @id @default(cuid())
  organizationId String?  // null = system template
  name           String
  description    String
  category       String
  tags           String[]
  definition     Json     // n8n workflow JSON
  icon           String?
  isPublic       Boolean  @default(false)
  usageCount     Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization? @relation(fields: [organizationId], references: [id])
}

model ApiKey {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  key            String   @unique
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model AIChat {
  id         String   @id @default(cuid())
  userId     String
  workflowId String?
  messages   Json     // Array of { role, content, timestamp }
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workflow Workflow?  @relation(fields: [workflowId], references: [id])
}

model ThemeConfig {
  id             String @id @default(cuid())
  organizationId String @unique
  config         Json   // ThemeConfig type serialized

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**Step 1.2: Setup Prisma Client**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/db/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

**Step 1.3: Setup NextAuth.js**

Install:
```bash
npm install next-auth@5 @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/auth/config.ts`:
```typescript
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db/prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    newUser: '/register',
  },
});
```

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from '@/lib/auth/config';
export const { GET, POST } = handlers;
```

**Step 1.4: Update Environment Variables**

Add to `.env.local`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/flowforge
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
GROK_API_KEY=xai-...
GROK_API_BASE_URL=https://api.x.ai/v1
GROK_MODEL=grok-3
AI_DEFAULT_PROVIDER=openai
```

---

**PHASE 2: AI Integration (Weeks 2-3)**

**Step 2.1: AI Provider Abstraction**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/ai/provider.ts`:

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  id: string;
  name: string;
  chat(messages: ChatMessage[]): Promise<string>;
  generateJSON<T>(messages: ChatMessage[], schema: object): Promise<T>;
}

export function getAIProvider(providerId?: string): AIProvider {
  const id = providerId || process.env.AI_DEFAULT_PROVIDER || 'openai';
  switch (id) {
    case 'openai': return new OpenAIProvider();
    case 'grok': return new GrokProvider();
    default: throw new Error(`Unknown AI provider: ${id}`);
  }
}
```

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/ai/openai.ts`:
```typescript
import type { AIProvider, ChatMessage } from './provider';

export class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI';

  private apiKey = process.env.OPENAI_API_KEY!;
  private model = process.env.OPENAI_MODEL || 'gpt-4o';
  private baseUrl = 'https://api.openai.com/v1';

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateJSON<T>(messages: ChatMessage[], schema: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: 'json_schema', json_schema: { name: 'workflow', schema } },
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content) as T;
  }
}
```

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/ai/grok.ts`:
```typescript
import type { AIProvider, ChatMessage } from './provider';

export class GrokProvider implements AIProvider {
  id = 'grok';
  name = 'Grok (xAI)';

  private apiKey = process.env.GROK_API_KEY!;
  private model = process.env.GROK_MODEL || 'grok-3';
  private baseUrl = process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1';

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) throw new Error(`Grok API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateJSON<T>(messages: ChatMessage[], schema: object): Promise<T> {
    // Grok uses OpenAI-compatible API, same approach
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You must respond with valid JSON matching this schema: ${JSON.stringify(schema)}`,
    };
    const allMessages = [systemMessage, ...messages];
    const text = await this.chat(allMessages);
    return JSON.parse(text) as T;
  }
}
```

**Step 2.2: Workflow Generation Prompts**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/ai/prompts.ts`:

```typescript
import type { NodeDefinition } from '@/lib/nodes/registry';

export function buildWorkflowGenerationPrompt(availableNodes: NodeDefinition[]): string {
  const nodeList = availableNodes.map(n =>
    `- ${n.name} (type: ${n.n8nNodeType}): ${n.description}`
  ).join('\n');

  return `You are an automation workflow builder AI. You create n8n-compatible workflow definitions.

Available nodes:
${nodeList}

When the user describes an automation they want, generate a complete n8n workflow JSON with:
1. A descriptive name
2. Appropriate trigger node (schedule, webhook, or manual)
3. Action nodes connected in logical order
4. Condition nodes for branching logic where needed
5. Proper connections between all nodes

Output the workflow as a JSON object with this structure:
{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "nodes": [
    {
      "id": "unique-id",
      "name": "Node Display Name",
      "type": "n8n-nodes-base.nodeType",
      "position": [x, y],
      "parameters": { ... },
      "typeVersion": 1
    }
  ],
  "connections": {
    "Source Node Name": {
      "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]]
    }
  }
}

Always include a trigger node as the first node. Position nodes in a left-to-right flow with 250px horizontal spacing.`;
}

export const CHAT_SYSTEM_PROMPT = `You are FlowForge AI, an intelligent automation assistant. You help users create, understand, and optimize automation workflows.

You can:
1. Create new workflows from natural language descriptions
2. Explain what existing workflows do
3. Suggest improvements to workflows
4. Debug workflow errors
5. Recommend templates based on user needs

When creating workflows, always confirm the user's requirements before generating. Ask clarifying questions if the request is ambiguous.

Respond conversationally but concisely. Use markdown formatting for clarity.`;
```

**Step 2.3: AI Chat API Route**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/api/ai/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getAIProvider } from '@/lib/ai/provider';
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { messages, chatId, providerId, workflowId } = body;

  const provider = getAIProvider(providerId);

  const aiMessages = [
    { role: 'system' as const, content: CHAT_SYSTEM_PROMPT },
    ...messages,
  ];

  const response = await provider.chat(aiMessages);

  // Save chat to database
  if (chatId) {
    await prisma.aIChat.update({
      where: { id: chatId },
      data: {
        messages: [...messages, { role: 'assistant', content: response, timestamp: new Date() }],
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.aIChat.create({
      data: {
        userId: session.user.id,
        workflowId: workflowId || null,
        messages: [...messages, { role: 'assistant', content: response, timestamp: new Date() }],
      },
    });
  }

  return NextResponse.json({ data: { content: response } });
}
```

**Step 2.4: Workflow Generation API Route**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/api/ai/generate-workflow/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getAIProvider } from '@/lib/ai/provider';
import { buildWorkflowGenerationPrompt } from '@/lib/ai/prompts';
import { NODE_REGISTRY } from '@/lib/nodes/registry';
import { validateWorkflowDefinition } from '@/lib/workflow-builder/validator';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt, providerId } = await request.json();
  const provider = getAIProvider(providerId);
  const systemPrompt = buildWorkflowGenerationPrompt(NODE_REGISTRY);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: prompt },
  ];

  const workflowJson = await provider.generateJSON(messages, {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      nodes: { type: 'array' },
      connections: { type: 'object' },
    },
    required: ['name', 'nodes', 'connections'],
  });

  // Validate the generated workflow
  const validation = validateWorkflowDefinition(workflowJson);

  return NextResponse.json({
    data: {
      workflow: workflowJson,
      validation,
      provider: provider.name,
    },
  });
}
```

---

**PHASE 3: Visual Workflow Builder (Weeks 3-5)**

**Step 3.1: Install React Flow**

```bash
npm install @xyflow/react
```

**Step 3.2: Node Registry**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/nodes/registry.ts`:

This file defines all available automation nodes. Each node maps to an n8n node type and includes a configuration schema for the right-panel form.

```typescript
export interface NodeDefinition {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'transform' | 'output';
  n8nNodeType: string;
  name: string;
  description: string;
  icon: string;       // Lucide icon name
  color: string;
  configSchema: Record<string, unknown>;  // JSON Schema
  tags: string[];
}

export const NODE_REGISTRY: NodeDefinition[] = [
  // Triggers
  {
    id: 'manual-trigger',
    type: 'trigger',
    n8nNodeType: 'n8n-nodes-base.manualTrigger',
    name: 'Manual Trigger',
    description: 'Start workflow manually',
    icon: 'Play',
    color: '#34d399',
    configSchema: {},
    tags: ['trigger', 'manual'],
  },
  {
    id: 'schedule-trigger',
    type: 'trigger',
    n8nNodeType: 'n8n-nodes-base.scheduleTrigger',
    name: 'Schedule',
    description: 'Run on a schedule (cron)',
    icon: 'Clock',
    color: '#34d399',
    configSchema: {
      type: 'object',
      properties: {
        rule: { type: 'string', title: 'Cron Expression', default: '0 * * * *' },
      },
    },
    tags: ['trigger', 'schedule', 'cron'],
  },
  {
    id: 'webhook-trigger',
    type: 'trigger',
    n8nNodeType: 'n8n-nodes-base.webhook',
    name: 'Webhook',
    description: 'Start workflow via HTTP webhook',
    icon: 'Webhook',
    color: '#34d399',
    configSchema: {
      type: 'object',
      properties: {
        httpMethod: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'POST' },
        path: { type: 'string', title: 'Webhook Path' },
      },
    },
    tags: ['trigger', 'webhook', 'http'],
  },
  // Actions
  {
    id: 'http-request',
    type: 'action',
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    name: 'HTTP Request',
    description: 'Make HTTP requests to any API',
    icon: 'Globe',
    color: '#60a5fa',
    configSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
        url: { type: 'string', title: 'URL' },
        headers: { type: 'object', title: 'Headers' },
        body: { type: 'string', title: 'Request Body' },
      },
    },
    tags: ['action', 'http', 'api'],
  },
  {
    id: 'send-email',
    type: 'action',
    n8nNodeType: 'n8n-nodes-base.emailSend',
    name: 'Send Email',
    description: 'Send an email via SMTP',
    icon: 'Mail',
    color: '#60a5fa',
    configSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', title: 'To' },
        subject: { type: 'string', title: 'Subject' },
        body: { type: 'string', title: 'Body' },
      },
    },
    tags: ['action', 'email', 'notification'],
  },
  {
    id: 'slack-message',
    type: 'action',
    n8nNodeType: 'n8n-nodes-base.slack',
    name: 'Slack Message',
    description: 'Send a message to a Slack channel',
    icon: 'MessageSquare',
    color: '#60a5fa',
    configSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', title: 'Channel' },
        text: { type: 'string', title: 'Message' },
      },
    },
    tags: ['action', 'slack', 'notification'],
  },
  // Conditions
  {
    id: 'if-condition',
    type: 'condition',
    n8nNodeType: 'n8n-nodes-base.if',
    name: 'If/Else',
    description: 'Branch based on a condition',
    icon: 'GitBranch',
    color: '#fbbf24',
    configSchema: {
      type: 'object',
      properties: {
        field: { type: 'string', title: 'Field' },
        operation: { type: 'string', enum: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan'] },
        value: { type: 'string', title: 'Value' },
      },
    },
    tags: ['condition', 'if', 'branch'],
  },
  {
    id: 'switch',
    type: 'condition',
    n8nNodeType: 'n8n-nodes-base.switch',
    name: 'Switch',
    description: 'Route to different paths based on value',
    icon: 'ArrowLeftRight',
    color: '#fbbf24',
    configSchema: {},
    tags: ['condition', 'switch', 'route'],
  },
  // Transforms
  {
    id: 'code',
    type: 'transform',
    n8nNodeType: 'n8n-nodes-base.code',
    name: 'Code',
    description: 'Run custom JavaScript code',
    icon: 'Code',
    color: '#818cf8',
    configSchema: {
      type: 'object',
      properties: {
        jsCode: { type: 'string', title: 'JavaScript Code' },
      },
    },
    tags: ['transform', 'code', 'javascript'],
  },
  {
    id: 'set-data',
    type: 'transform',
    n8nNodeType: 'n8n-nodes-base.set',
    name: 'Set Data',
    description: 'Set or modify data fields',
    icon: 'FileEdit',
    color: '#818cf8',
    configSchema: {},
    tags: ['transform', 'data', 'set'],
  },
  // ... additional nodes
];
```

**Step 3.3: Builder Page**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/(dashboard)/workflows/[id]/page.tsx`:

This is the main visual builder page. It wraps React Flow with the node palette, config panel, and AI chat sidebar.

**Step 3.4: Custom React Flow Nodes**

Create custom node components under `src/components/workflow-builder/custom-nodes/` that render with the Obsidian Forge theme. Each node type (trigger, action, condition, transform) gets a distinct visual treatment matching the existing color palette from `globals.css`.

**Step 3.5: Builder-to-n8n Converter**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/workflow-builder/converter.ts`:

This bidirectional converter translates between the React Flow graph representation and the n8n workflow JSON format. It maps node positions, connections, and configurations.

---

**PHASE 4: Refactoring Existing Features (Weeks 4-5)**

**Step 4.1: Refactor Layout and Navigation**

Modify `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/components/layout/sidebar.tsx`:

The sidebar currently has hardcoded `ForgeCadNeo` branding (line 58-63) and fixed `navItems` (lines 31-37). These must become dynamic:

```typescript
// Replace hardcoded navItems with a dynamic list based on organization config
const getNavItems = (orgConfig: OrgConfig): NavItem[] => {
  const coreItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Workflows', href: '/workflows', icon: Workflow },
    { label: 'Templates', href: '/templates', icon: BookOpen },
    { label: 'Monitoring', href: '/monitoring', icon: Activity },
  ];

  // Plugin items based on org configuration
  const pluginItems: NavItem[] = [];
  if (orgConfig.plugins.includes('reddit-monitor')) {
    pluginItems.push({ label: 'Reddit Monitor', href: '/plugins/reddit', icon: Radio });
  }
  if (orgConfig.plugins.includes('content-hub')) {
    pluginItems.push({ label: 'Content Hub', href: '/plugins/content', icon: FileText });
  }
  if (orgConfig.plugins.includes('directory-tracker')) {
    pluginItems.push({ label: 'Directories', href: '/plugins/directories', icon: FolderOpen });
  }

  const settingsItems: NavItem[] = [
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return [...coreItems, ...pluginItems, ...settingsItems];
};
```

Replace the hardcoded brand section with dynamic theming:
```typescript
// Replace lines 52-65 in sidebar.tsx
<div className="flex h-16 items-center gap-3 border-b border-border px-4">
  {theme.logo ? (
    <img src={theme.logo.url} alt={theme.brandName} className="h-9 w-9" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-forge-accent-muted)]">
      <Hexagon className="h-5 w-5 text-[var(--color-forge-accent)]" />
    </div>
  )}
  {!collapsed && (
    <div className="flex flex-col overflow-hidden">
      <span className="truncate text-sm font-semibold text-[var(--color-forge-text-primary)]">
        {theme.brandName}
      </span>
      <span className="truncate text-xs text-[var(--color-forge-text-muted)]">
        {theme.brandSubtitle}
      </span>
    </div>
  )}
</div>
```

**Step 4.2: Refactor Providers**

Modify `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/providers.tsx`:

Add auth session provider and theme provider alongside the existing QueryClientProvider:

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { ThemeProvider } from "@/components/layout/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

**Step 4.3: Refactor Dashboard Page**

Modify `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/page.tsx`:

Replace ForgeCadNeo-specific KPI cards (Reddit Matches, Total Karma, Website Status, Content Queue, Directories) with generic workflow-focused metrics:

- Total Workflows (active/total)
- Executions Today (success rate)
- Average Execution Time
- Failed Workflows (requiring attention)
- AI Conversations
- Active Templates

The existing `KpiCard` component at `src/components/dashboard/kpi-card.tsx` is already generic and needs no changes. The existing chart components in `src/components/charts/metrics-chart.tsx` need new data sources but the chart structure itself is reusable.

**Step 4.4: Move ForgeCadNeo-Specific Pages to Plugins**

Move the existing pages to a plugins structure:
- `src/app/reddit/page.tsx` becomes `src/app/(dashboard)/plugins/reddit/page.tsx`
- `src/app/content/page.tsx` becomes `src/app/(dashboard)/plugins/content/page.tsx`
- `src/app/directories/page.tsx` becomes `src/app/(dashboard)/plugins/directories/page.tsx`

The existing API routes remain functional but are grouped under a `/api/plugins/` namespace:
- `src/app/api/reddit/*` stays as-is (backward compatible)
- These become opt-in features per organization

**Step 4.5: Split Hooks**

The current `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/hooks/use-data.ts` contains all data hooks mixed together (Reddit, content, directories, n8n workflows). Split into domain-specific hooks:

- `src/hooks/use-workflows.ts` -- Generic workflow CRUD and execution hooks (extracted from lines 134-198 of current use-data.ts)
- `src/hooks/use-ai-chat.ts` -- AI chat conversation hooks
- `src/hooks/use-executions.ts` -- Execution monitoring hooks
- `src/hooks/use-templates.ts` -- Template hooks
- `src/hooks/use-organization.ts` -- Organization and theme hooks
- Keep `src/hooks/use-data.ts` for backward compatibility with plugin pages

**Step 4.6: Extend n8n Client**

Modify `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/n8n.ts`:

Add workflow CRUD methods needed for the builder:

```typescript
// Add to existing n8n.ts

export async function createWorkflow(workflowData: {
  name: string;
  nodes: unknown[];
  connections: unknown;
  settings?: unknown;
}) {
  return n8nFetch('/api/v1/workflows', {
    method: 'POST',
    body: workflowData as Record<string, unknown>,
  });
}

export async function updateWorkflow(id: string, workflowData: Record<string, unknown>) {
  return n8nFetch(`/api/v1/workflows/${id}`, {
    method: 'PUT',
    body: workflowData,
  });
}

export async function deleteWorkflow(id: string) {
  return n8nFetch(`/api/v1/workflows/${id}`, {
    method: 'DELETE',
  });
}

export async function getExecutionData(executionId: string) {
  return n8nFetch(`/api/v1/executions/${executionId}?includeData=true`);
}
```

---

**PHASE 5: AI Chat UI and Workflow Templates (Weeks 5-6)**

**Step 5.1: AI Chat Panel Component**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/components/ai/chat-panel.tsx`:

A slide-over panel (or embedded sidebar) that provides the AI chat interface. Styled with the Obsidian Forge theme. Supports:
- Text input with send button
- Streaming response display (using SSE or polling)
- Markdown rendering in responses
- Code block rendering for generated workflows
- "Apply Workflow" button when AI generates a workflow
- Provider selector (OpenAI / Grok)

This follows the existing component patterns: `"use client"` directive, lucide-react icons, shadcn/ui primitives (Card, Button, Input), Obsidian Forge CSS custom properties.

**Step 5.2: Workflow Templates Page**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/(dashboard)/templates/page.tsx`:

A grid of template cards (reusing the card pattern from the workflows page) with:
- Category filtering (marketing, sales, devops, customer support, etc.)
- Search
- "Use Template" button that creates a new workflow from the template
- System templates (pre-seeded) and organization templates

**Step 5.3: Seed Data**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/prisma/seed.ts`:

Pre-populate with templates extracted from the current ForgeCadNeo workflows:
- Reddit Monitoring template (from current `monitor-reddit.py` / `reddit-monitor.json`)
- Content Scheduling template (from current `social-scheduler.json`)
- Daily Metrics Collection template (from current `track-metrics.sh`)
- Generic templates: "Webhook to Slack", "Schedule API Health Check", "Email Digest", etc.

---

**PHASE 6: Testing and Monitoring (Week 6)**

**Step 6.1: Workflow Test Runner**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/api/workflows/[id]/test/route.ts`:

Executes the workflow in n8n with provided sample input data and returns execution results including per-node outputs. The frontend displays this in an execution console at the bottom of the workflow builder.

**Step 6.2: Monitoring Dashboard**

Create `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/(dashboard)/monitoring/page.tsx`:

A generic version of the current overview page that shows:
- Execution volume over time (line chart, reusing `MetricsLineChart` pattern)
- Success/failure rate (pie chart, reusing `DirectoryPieChart` pattern)
- Per-workflow execution stats (table, reusing the table pattern from workflows page)
- Real-time execution feed (reusing the execution table from workflows page)

---

### New Dependencies to Install

```json
{
  "dependencies": {
    "@auth/prisma-adapter": "^2.0.0",
    "@prisma/client": "^6.0.0",
    "@xyflow/react": "^12.0.0",
    "bcryptjs": "^2.4.3",
    "next-auth": "^5.0.0",
    "zod": "^3.23.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.6.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^6.0.0"
  }
}
```

---

### Key Architecture Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Database | PostgreSQL + Prisma | Multi-tenant ACID, type-safe ORM, migration support |
| Auth | NextAuth.js v5 | Native Next.js App Router integration, multiple providers |
| Visual Builder | React Flow (@xyflow/react) | Industry standard, React native, customizable nodes |
| AI | OpenAI + Grok via abstraction | Multiple providers, structured output, fallback |
| Multi-tenancy | Organization-based | Shared infrastructure, per-org data isolation |
| Theming | CSS custom properties | Already used, runtime-swappable, no rebuild needed |
| State Management | TanStack Query (keep) | Already in use, excellent for server state |
| n8n Integration | REST API (keep) | Already working, extend with CRUD |
| Legacy Features | Plugin pattern | Non-breaking, opt-in per organization |

---

### Critical Files for Implementation

- `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/lib/n8n.ts` - Core n8n API client that must be extended with create/update/delete workflow methods and per-node execution data retrieval; the existing `n8nFetch` helper and authentication pattern at lines 18-51 serve as the template for all new methods
- `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/providers.tsx` - Central provider wrapper that must be extended with SessionProvider (NextAuth) and ThemeProvider; currently only wraps QueryClientProvider at lines 6-23
- `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/components/layout/sidebar.tsx` - Navigation and branding component with hardcoded ForgeCadNeo brand (lines 52-65) and static navItems (lines 31-37) that must become dynamic and theme-driven
- `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/hooks/use-data.ts` - Monolithic data hooks file (233 lines) combining all domain hooks that must be split into domain-specific modules while maintaining backward compatibility for plugin pages
- `/Users/abhisheksharma/work/forgecadneo/automation/dashboard/src/app/globals.css` - Theme definition with Obsidian Forge CSS custom properties (lines 52-71) that must be extended to support runtime theme injection from database-stored per-organization configurations