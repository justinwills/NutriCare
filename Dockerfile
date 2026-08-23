FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip libgl1 libglib2.0-0 libgomp1 libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages paddlepaddle paddleocr onnxruntime

ENV GLOG_minloglevel=3 \
    PADDLE_PDX_LOG_LEVEL=ERROR \
    PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False \
    FLAGS_use_onednn=0 \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True \
    PYTHONWARNINGS=ignore

# Pre-download and cache PaddleOCR ONNX models into container image layer
RUN python3 -c "import numpy as np, cv2, os; os.environ['GLOG_minloglevel']='3'; os.environ['PADDLE_PDX_LOG_LEVEL']='ERROR'; os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK']='True'; img = np.zeros((100, 100, 3), dtype=np.uint8); cv2.imwrite('/tmp/warmup.jpg', img); from paddleocr import PaddleOCR; ocr = PaddleOCR(use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, engine='onnxruntime'); list(ocr.predict('/tmp/warmup.jpg')); os.remove('/tmp/warmup.jpg'); print('ONNX OCR WARMUP COMPLETED')"

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install
RUN npm --prefix backend install
COPY . .

EXPOSE 8080
CMD ["npm", "start"]