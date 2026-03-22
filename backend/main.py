import os
from contextlib import asynccontextmanager

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    def load_dotenv():
        return False


from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from graph import get_broken_flows, get_full_graph_json, get_graph, get_graph_stats, get_node_neighbors, get_o2c_flow
from llm import run_query


load_dotenv()

DB_PATH = os.getenv("DB_PATH", "./data/o2c.db")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "../frontend/dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_graph()
    yield


app = FastAPI(title="SAP O2C Graph API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


SUGGESTED_QUERIES = [
    "Which products appear in the most billing documents?",
    "Show me sales orders that were delivered but never billed",
    "Who are the top 5 customers by total order value?",
    "Show me all cancelled billing documents",
    "Which deliveries have not been billed yet?",
    "What is the total billed amount per customer?",
    "Show me sales orders with no delivery at all",
    "Which plants handle the most deliveries?",
]


@app.get("/api/health")
def health():
    graph = get_graph()
    return {"status": "ok", "nodes": graph.number_of_nodes(), "edges": graph.number_of_edges()}


@app.get("/api/llm-status")
def llm_status():
    return {
        "groq_key_set": bool(os.getenv("GROQ_API_KEY")),
        "model": "llama-3.3-70b-versatile",
        "status": "ok",
    }


@app.get("/api/graph")
def graph_data():
    return get_full_graph_json(get_graph())


@app.get("/api/graph/node/{node_id}")
def graph_node(node_id: str):
    payload = get_node_neighbors(get_graph(), node_id)
    if payload["node"] is None:
        raise HTTPException(status_code=404, detail="Node not found")
    return payload


@app.get("/api/graph/expand/{node_id}")
def graph_expand(node_id: str):
    return graph_node(node_id)


@app.get("/api/stats")
def stats():
    return get_graph_stats(get_graph())


@app.get("/api/flow/{sales_order}")
def flow(sales_order: str):
    payload = get_o2c_flow(get_graph(), DB_PATH, sales_order)
    if payload["salesOrder"] is None:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return payload


@app.get("/api/broken-flows")
def broken_flows():
    flows = get_broken_flows(get_graph(), DB_PATH)
    return {"broken_flows": flows, "count": len(flows)}


@app.post("/api/chat")
def chat(body: ChatRequest):
    history = [item.model_dump() for item in body.history][-6:]
    return run_query(body.query, DB_PATH, conversation_history=history)


@app.get("/api/suggested-queries")
def suggested_queries():
    return {"queries": SUGGESTED_QUERIES}


@app.get("/", include_in_schema=False)
async def serve_root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(STATIC_DIR):
        return FileResponse(index)
    raise HTTPException(status_code=404)


if os.path.exists(STATIC_DIR):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(STATIC_DIR, "assets")),
        name="assets",
    )
