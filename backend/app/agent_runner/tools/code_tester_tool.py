from langchain_core.tools import tool
from langchain_experimental.tools import PythonREPLTool


@tool
def CodeTesterTool(code: str) -> str:
    """Execute Python code and return output or error details."""
    repl = PythonREPLTool()
    try:
        result = repl.run(code)
    except Exception as exc:
        return f"Code tester execution error: {exc}\n\nProvide clean, small reproducible code snippet to run."

    # Do not expose interactive environment details
    return f"=== Code execution output ===\n{result}\n\n=== Suggestion ===\nIf there is a failure, correct the code and rerun."
