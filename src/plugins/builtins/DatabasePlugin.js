import { registerPlugin } from '../registry';
import DbSidebar from '../../components/Database/DbSidebar';
import DbQueryPanel from '../../components/Database/DbQueryPanel';

export const DatabasePlugin = {
  id: 'database',
  name: 'MySQL Database',
  version: '1.0.0',
  icon: '🗄',
  description:
    'Connect to MySQL, PostgreSQL, and MongoDB. Browse schemas / collections and run SQL or MongoDB queries.',
  author: 'built-in',

  sidebarTab: {
    label: 'Database',
    order: 10,
    component: DbSidebar,
  },

  // Shown in the main workspace when the active tab has type === 'db'
  panelComponent: DbQueryPanel,
  tabType: 'db',
};

registerPlugin(DatabasePlugin);
