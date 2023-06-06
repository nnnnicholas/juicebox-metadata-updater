# Juicebox Metadata Updater

This cron process refreshes Juicebox Project NFT and Juicebox Cards metadata on Opensea. The metadata is updating as time elapses and transactions are made, and this utility helps keep Opensea's offchain cache, which many people rely upon, up to date.

## Setup

### Getting started

Clone this repository:

```bash
git clone https://github.com/yourusername/Juicebox-Metadata-Updater.git
cd Juicebox-Metadata-Updater
```

### Install dependencies

This project uses `pnpm` as a package manager. If you don't have `pnpm` installed, install it globally using `npm`:

```bash
npm install -g pnpm
```

Then  the project dependencies:

```bash
pnpm install
```

### Configuration

Copy the `.example.env` file to a new file named `.env`. Fill out all fields in the `.env` file:

```bash
cp .example.env .env
```

## Development

Start the development server using `pnpm`:

```bash
pnpm dev
```

## Building for production

Build the application for production:

```bash
pnpm build
```

This command will compile the TypeScript files and output them to the `dist` directory.

## Deployment

This application is designed to be run continuously on a production server using a process manager such as `pm2`.

You can start the application without installing pm2 globally as it is already in the project dependencies:

```bash
pnpm start
```

This will start the application and keep it running, even if the server restarts.

## Logs

You can view the application logs using the provided scripts:

```bash
pnpm logs
```

## Stopping the Application

To stop the application:

```bash
pnpm stop
```

## Restarting the Application

To restart the application:

```bash
pnpm restart
```

## Removing the Application

To remove the application from `pm2`:

```bash
pnpm delete
```

## Killing `pm2`

To kill the `pm2` daemon:

```bash
pnpm kill
```