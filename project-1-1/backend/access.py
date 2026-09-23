"""Identity boundary for operator and trusted student gateway callers.

The gateway must validate the student's session and entitlement before forwarding.
Neither bearer credential belongs in a browser. An operator cannot become a student
merely by adding a caller-controlled header, and the gateway cannot become operator.
"""
import hashlib
import secrets
import uuid


def resolve_identity(authorization, learner, operator_token, gateway_token=''):
    if secrets.compare_digest(authorization, 'Bearer ' + operator_token):
        return hashlib.sha256(operator_token.encode()).hexdigest()
    if len(gateway_token) >= 32 and secrets.compare_digest(authorization, 'Bearer ' + gateway_token):
        try:
            owner = str(uuid.UUID(learner or ''))
        except (ValueError, TypeError, AttributeError):
            raise ValueError('invalid_gateway_identity') from None
        return 'learner:' + owner
    raise ValueError('authentication_required')
