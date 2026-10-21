import * as auth from '../services/authService.js';

export const login = (req, res) => {
  const result = auth.login(req.body?.pin, req.ip);
  res.json({ success: true, data: result });
};
export const logout = (req, res) => {
  auth.revoke(req.staff);
  res.json({ success: true, data: { loggedOut: true } });
};
