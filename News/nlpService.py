"""
Fast NLP microservice: stock-news relevance + sentiment
- SentenceTransformer embeddings with caching
- Batch relevance scoring
- DistilBERT sentiment analysis
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import numpy as np
import uvicorn
import asyncio

from sentence_transformers import SentenceTransformer
from transformers import pipeline

app = FastAPI(title="Stock News NLP Service")

# ---------------- Models ----------------
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
SENTIMENT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"

print("Loading embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL_NAME)
print("Loading sentiment model...")
sentiment_pipe = pipeline("sentiment-analysis", model=SENTIMENT_MODEL)

# ---------------- Alias embedding cache ----------------
alias_cache: Dict[str, np.ndarray] = {}
cache_lock = asyncio.Lock()

# ---------------- Pydantic schemas ----------------
class BatchItem(BaseModel):
    code: str
    aliases: List[str]

class BatchRequest(BaseModel):
    text: str
    candidates: List[BatchItem]

class BatchResponseItem(BaseModel):
    code: str
    relevance_score: float
    relevant: bool
    sentiment_label: str
    sentiment_score: float

# ---------------- Utility functions ----------------
def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom != 0 else 0.0

async def get_alias_embedding(alias: str) -> np.ndarray:
    key = alias.strip().lower()
    async with cache_lock:
        if key in alias_cache:
            return alias_cache[key]
        emb = embed_model.encode(alias, convert_to_numpy=True, normalize_embeddings=True)
        alias_cache[key] = emb
        return emb

def sentiment_analysis(text: str):
    try:
        res = sentiment_pipe(text[:512])[0]
        return res["label"].lower(), float(res["score"])
    except Exception:
        return "neutral", 0.0

def is_alias_in_text(text: str, aliases: List[str]) -> bool:
    """Check if any alias appears in the text."""
    text_upper = text.upper()
    return any(alias.upper() in text_upper for alias in aliases)

# ---------------- Endpoints ----------------
@app.post("/analyze_batch", response_model=List[BatchResponseItem])
async def analyze_batch(req: BatchRequest):
    if not req.text:
        raise HTTPException(status_code=400, detail="Missing text")

    text_emb = embed_model.encode(req.text, convert_to_numpy=True, normalize_embeddings=True)
    label, score = sentiment_analysis(req.text)
    results = []

    for cand in req.candidates:
        aliases = cand.aliases.copy()
        if cand.code.upper() not in [a.upper() for a in aliases]:
            aliases.append(cand.code)

        sims = []
        for alias in aliases:
            emb = await get_alias_embedding(alias)
            sims.append(cosine_sim(text_emb, emb))
        max_sim = max(sims) if sims else 0.0
        relevant = max_sim >= 0.4 and is_alias_in_text(req.text, aliases)

        results.append({
            "code": cand.code,
            "relevance_score": round(max_sim, 3),
            "relevant": relevant,
            "sentiment_label": label,
            "sentiment_score": score
        })

    return results

# ---------------- Run ----------------
if __name__ == "__main__":
    uvicorn.run("nlpService:app", host="0.0.0.0", port=8000, log_level="info")
