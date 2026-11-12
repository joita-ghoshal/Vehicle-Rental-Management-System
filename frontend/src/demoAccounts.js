// Presentation only. Credentials come from the isolated demo API, never this build.
export const DEMO_ACCOUNT_LABELS = {
  customer: {
    title: 'Demo customer',
    badge: 'Customer access',
    description: 'Browse vehicles, check availability, send booking requests and manage your own bookings.',
  },
  admin: {
    title: 'Main admin',
    badge: 'Full-control admin',
    description: 'Full control: dashboard, vehicles, customers, every booking, approvals, rejections, completion and revenue.',
  },
}

export function demoCredentialsText(account) {
  return `Email: ${account.email}\nPassword: ${account.password}`
}
