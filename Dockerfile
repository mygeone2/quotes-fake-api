# Use the official Node.js 18 Bullseye Slim image
FROM node:18-bullseye-slim

# Create and set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port 3000
EXPOSE 8081

# Start the application
CMD ["npm", "start"]
