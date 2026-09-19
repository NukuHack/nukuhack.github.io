import DataList from '../components/DataList.jsx';

const extraHelper = [
  {
    id: 2,
    title: 'Nav update',
    content: 'Had to update the navBar because I made too much separate pages',
    extra: '2025.02.15. 10:41',
  },
  {
    id: 1,
    title: 'Christmas',
    content: 'Have a Very Merry Christmas',
    extra: 'have a good one - 2024.12.24',
  },
  {
    id: 0,
    title: 'Last Update :',
    content: 'This page has been updated : 2024.12.24 23:00',
    extra: 'But it is still maintained currently',
  },
];

export default function Extra() {
  return <DataList items={extraHelper} renderContent={(item) => item.content} />;
}
