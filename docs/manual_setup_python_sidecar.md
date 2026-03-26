# Manual Setup: Python Sidecar & Dependencies

## Context

Subagent execution for managing the Python sidecar and its dependencies (Presidio, spaCy) has encountered persistent failures, including SIGKILL errors and "No such file or directory" errors for brief files. These issues indicate fundamental problems with the subagent execution environment concerning file access and native module handling.

To proceed with development, the Python sidecar and its dependencies must be set up manually.

## Prerequisites

*   **Python 3.14+:** Ensure Python 3.14 is installed and accessible in your system's PATH.
*   **Pip:** Ensure pip is installed for your Python environment.
*   **Git:** Ensure Git is installed.

## Setup Steps

Execute the following commands in your terminal:

1.  **Navigate to Project Root:**
    ```bash
    cd "/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil"
    ```

2.  **Create and Activate Python Virtual Environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
    *   *(If `python3` is not in your PATH, use the absolute path to your Python 3.14 installation, e.g., `/opt/homebrew/bin/python3 -m venv venv`)*

3.  **Install Python Dependencies:**
    ```bash
    pip install -r sidecar/requirements.txt
    ```
    *   *(This command assumes `requirements.txt` is located in the `sidecar` subdirectory relative to your current location)*

4.  **Download spaCy Model:**
    ```bash
    python -m spacy download en_core_web_lg
    ```

5.  **Run the Python Sidecar Server:**
    ```bash
    python sidecar/server.py
    ```

**Verification:**
Once the server starts, it should print `{"status":"ready", "pid":<pid>}` to the console. **Keep this terminal window open**, as the server needs to be running for the Electron app to communicate with it.

## Next Steps (After Manual Setup)

Once the Python sidecar is running:

1.  **Direct IPC Integration:** Update the Electron main process (`app/src/main/sidecar/index.ts`) to communicate directly with the running Python sidecar via its Unix socket, bypassing the failed subagent spawning mechanism.
2.  **Re-attempt Tasks:** Adjust the briefs for Task 2.2 (PII Detection) and Task 1.6 (Integration Test) to interact with the manually running sidecar.

## Documenting Environment Issues

Persistent issues with subagent execution, file access, and native module handling have been documented in `docs/TECH_ISSUES_SUBAGENT_ENV.md` for future reference and debugging.
