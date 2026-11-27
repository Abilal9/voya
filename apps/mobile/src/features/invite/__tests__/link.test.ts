import { inviteTokenFrom } from '../link';

describe('invitation path', () => {
  it('reads the token from /invite/<token> only', () => {
    expect(inviteTokenFrom('/invite/inv-florence')).toBe('inv-florence');
    expect(inviteTokenFrom('/invite/inv-florence/')).toBe('inv-florence');
    expect(inviteTokenFrom('/invite/')).toBeUndefined();
    expect(inviteTokenFrom('/invite/a b')).toBeUndefined();
    expect(inviteTokenFrom('/trip/plan-florence')).toBeUndefined();
    expect(inviteTokenFrom('/invite/x/extra')).toBeUndefined();
  });
});
