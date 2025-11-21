# Samsyn

Interactive web application for visualizing and collaborating on geospatial data with support for multiple layer types, real-time commenting, and user authentication.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A [Clerk](https://clerk.com) account (free tier available)

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:

   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
   ```

   Get your Clerk publishable key from the [Clerk Dashboard](https://dashboard.clerk.com).

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to `http://localhost:5173`

## Tech Stack

React • TypeScript • Vite • MapLibre GL • deck.gl • Tailwind CSS • Clerk

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development guidance.
