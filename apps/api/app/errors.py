class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class VisionProviderError(RuntimeError):
    """Raised when an external vision provider cannot return a valid result."""


class VisionProviderConfigurationError(RuntimeError):
    """Raised when the selected vision provider cannot be initialized safely."""


class AppConfigurationError(RuntimeError):
    """Raised when a public deployment is missing required access controls."""
