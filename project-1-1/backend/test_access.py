import unittest
from access import resolve_identity

class AccessTests(unittest.TestCase):
    operator='o'*40
    gateway='g'*40
    alice='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
    bob='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

    def test_anonymous_and_owner_spoof_denied(self):
        for auth in ['', 'Bearer wrong']:
            with self.assertRaises(ValueError):
                resolve_identity(auth,self.alice,self.operator,self.gateway)

    def test_gateway_requires_configured_strong_secret(self):
        for secret in ['', 'short']:
            with self.assertRaises(ValueError):
                resolve_identity('Bearer '+secret,self.alice,self.operator,secret)

    def test_operator_header_cannot_select_student(self):
        a=resolve_identity('Bearer '+self.operator,self.alice,self.operator,self.gateway)
        b=resolve_identity('Bearer '+self.operator,self.bob,self.operator,self.gateway)
        self.assertEqual(a,b)
        self.assertFalse(a.startswith('learner:'))

    def test_gateway_owners_are_distinct(self):
        a=resolve_identity('Bearer '+self.gateway,self.alice,self.operator,self.gateway)
        b=resolve_identity('Bearer '+self.gateway,self.bob,self.operator,self.gateway)
        self.assertNotEqual(a,b)
        self.assertEqual(a,'learner:'+self.alice)

    def test_gateway_requires_uuid(self):
        for owner in ['', 'Administrator', '../sessions', 'x'*1000]:
            with self.assertRaises(ValueError):
                resolve_identity('Bearer '+self.gateway,owner,self.operator,self.gateway)

if __name__=='__main__':unittest.main()
