# Comalt Download Manager

A secure, web-based file distribution system that uses blockchain wallet authentication to manage and control access to downloads.

## Overview

Comalt Download Manager is a Next.js application that provides a secure interface for distributing files to authenticated users. It uses Polkadot/Substrate wallet signature authentication to verify user identity, with optional whitelist restrictions to control access to sensitive content.

## Features

- **Blockchain Wallet Authentication**: Secure login using Polkadot/Substrate wallet signatures
- **Whitelist Access Control**: Restrict access to specific wallet addresses
- **Public/Private Modes**: Toggle between open access and whitelist-restricted mode
- **Persistent Authentication**: JWT-based session management
- **Responsive UI**: Works on desktop and mobile devices
- **User Management**: Admin interface for managing users and permissions
- **Download Analytics**: Track and analyze file download metrics

## Technologies

- **Frontend**: Next.js, React, TypeScript
- **Authentication**: Polkadot/Substrate wallet signature verification
- **State Management**: React Context
- **Styling**: CSS Modules, Tailwind CSS
- **Database**: Prisma with your choice of database backend
- **API**: Next.js API Routes

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn
- A Polkadot/Substrate compatible wallet (like Polkadot.js extension)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/download-manager.git
   cd download-manager
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Copy the example environment file and update it with your settings:

   ```bash
   cp .env.example .env
   ```

4. Set up the database (if using Prisma):

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Configuration

The application requires several environment variables to be configured:

```properties
# JWT
# Generate a secure secret with:
# Windows: powershell -c "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"
# Unix: openssl rand -base64 32
JWT_SECRET="your-secure-jwt-secret"

# API Configuration
POLKADOT_API_URL=https://rpc.polkadot.io

# Public variables (accessible in browser)
NEXT_PUBLIC_APP_NAME=Comalt Download Manager
NEXT_PUBLIC_APP_VERSION=1.0.0

# Whitelist Configuration (server-side only)
# Comma-separated list of wallet addresses that are allowed to access the app
# Leave empty for public mode (all addresses allowed)
ALLOWED_WALLETS=5FBihsF4H6PGKjnbV4R7RKqQN4abFd4AhxUNukaPvj3Susdt,second_address,third_address
```

## Authentication System

The application uses a multi-step authentication process:

1. **Wallet Connection**: User connects their Polkadot/Substrate wallet
2. **Whitelist Verification**: Server checks if the wallet address is allowed
3. **Signature Challenge**: User signs a unique message with their wallet
4. **JWT Issuance**: Upon successful verification, the server issues a JWT
5. **Session Management**: The JWT is stored locally for persistent sessions

### Public vs. Restricted Mode

- **Public Mode**: When `ALLOWED_WALLETS` is empty, any wallet can authenticate
- **Restricted Mode**: Only wallet addresses in the whitelist can authenticate

## API Endpoints

The application includes several API endpoints:

- `/api/auth/check-mode` - Check if the application is in public or restricted mode
- `/api/auth/validate-address` - Verify if a wallet address is allowed
- `/api/wallet` - Authenticate with wallet signature
- `/api/wallet/verify` - Verify JWT token
- `/api/admin/users` - Admin user management

## Development Workflow

### Local Development

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Make your changes and test in the browser

3. Check for type errors:

   ```bash
   npm run typecheck
   ```

4. Format your code:

   ```bash
   npm run format
   ```

### Debugging

The application includes a debugging panel that can be enabled in development mode to help diagnose authentication issues. It shows the current authentication state and allows you to trigger actions.

## Authentication Troubleshooting

If you're experiencing authentication issues:

1. Ensure your wallet extension is installed and unlocked
2. Verify that your wallet address is in the whitelist (if in restricted mode)
3. Check browser console for any errors during signature requests
4. Ensure the JWT_SECRET is properly set in your environment
5. Clear local storage and try again if problems persist

## Production Deployment

1. Build the application:

   ```bash
   npm run build
   ```

2. Start the production server:

   ```bash
   npm start
   ```

## Security Considerations

- Always keep your `JWT_SECRET` secure and unique per environment
- In production, use HTTPS to encrypt all communication
- Whitelist addresses are kept server-side for security
- Never commit .env files to version control

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
