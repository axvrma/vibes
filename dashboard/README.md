# Vibes Dashboard

The web-based administration dashboard for the Vibes private media platform. This frontend allows you to manage video content, view analytics, and control access.

## Tech Stack
- **Angular 18** for the frontend framework
- **Angular Material** for UI components
- **TypeScript**

## Development Server

To run the dashboard locally:

```bash
npm install
npm run start
```
Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Build for Production

Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Testing

Run `npm run test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Docker

A Dockerfile is provided in the `../infra` directory to package the built Angular app into an Nginx container for production deployment. See `infra/README.md` for more details.
