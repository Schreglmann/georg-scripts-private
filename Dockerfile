# Use an official Node runtime as a parent image
FROM registry.access.redhat.com/ubi10/nodejs-24

USER 1001

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package files
COPY --chown=1001:0 package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY --chown=1001:0 ./ ./

# Build TypeScript
RUN npm run build

# Run the CLI when the container launches
ENTRYPOINT ["node", "bin/infra.js"]
