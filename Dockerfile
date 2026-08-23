FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip libgl1 libglib2.0-0 libgomp1 libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages paddlepaddle paddleocr

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install
RUN npm --prefix backend install
COPY . .

EXPOSE 3002
CMD ["npm", "start"]