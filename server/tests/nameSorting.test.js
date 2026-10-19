const {
  getSurnameAndGivenName,
  getSurname,
  compareBySurname,
  sortBySurname
} = require('../utils/nameSorting');

describe('nameSorting utility', () => {
  describe('getSurnameAndGivenName', () => {
    test('extracts surname and given name from two-word name', () => {
      expect(getSurnameAndGivenName('John Doe')).toEqual({
        surname: 'Doe',
        givenName: 'John'
      });
    });

    test('extracts surname and given name from multi-word name', () => {
      expect(getSurnameAndGivenName('John Michael Doe')).toEqual({
        surname: 'Doe',
        givenName: 'John Michael'
      });
      expect(getSurnameAndGivenName('APJ Abdul Kalam')).toEqual({
        surname: 'Kalam',
        givenName: 'APJ Abdul'
      });
    });

    test('handles single name', () => {
      expect(getSurnameAndGivenName('Cher')).toEqual({
        surname: 'Cher',
        givenName: ''
      });
    });

    test('handles whitespace and extra spaces', () => {
      expect(getSurnameAndGivenName('  Rahul    Sharma  ')).toEqual({
        surname: 'Sharma',
        givenName: 'Rahul'
      });
    });

    test('handles empty or missing name', () => {
      expect(getSurnameAndGivenName('')).toEqual({
        surname: '',
        givenName: ''
      });
      expect(getSurnameAndGivenName(null)).toEqual({
        surname: '',
        givenName: ''
      });
    });
  });

  describe('compareBySurname and sortBySurname', () => {
    test('sorts list of users alphabetically by surname', () => {
      const users = [
        { name: 'Bruce Wayne' },     // Surname: Wayne
        { name: 'Peter Parker' },    // Surname: Parker
        { name: 'Clark Kent' },      // Surname: Kent
        { name: 'Diana Prince' },    // Surname: Prince
        { name: 'Tony Stark' },      // Surname: Stark
        { name: 'Barry Allen' },     // Surname: Allen
        { name: 'Arthur Curry' },    // Surname: Curry
        { name: 'John Curry' }       // Surname: Curry (Tie-break by first name: Arthur before John)
      ];

      const sorted = sortBySurname(users);
      const names = sorted.map(u => u.name);

      expect(names).toEqual([
        'Barry Allen',
        'Arthur Curry',
        'John Curry',
        'Clark Kent',
        'Peter Parker',
        'Diana Prince',
        'Tony Stark',
        'Bruce Wayne'
      ]);
    });

    test('handles populated user objects where name is in user.name', () => {
      const records = [
        { user: { name: 'Steve Rogers' } },
        { user: { name: 'Natasha Romanoff' } },
        { user: { name: 'Clint Barton' } }
      ];

      const sorted = sortBySurname(records);
      expect(sorted.map(r => r.user.name)).toEqual([
        'Clint Barton',     // Barton
        'Steve Rogers',     // Rogers
        'Natasha Romanoff'  // Romanoff
      ]);
    });

    test('handles case sensitivity correctly (case-insensitive base)', () => {
      const users = [
        { name: 'john doe' },
        { name: 'Adam Brown' },
        { name: 'Jane Doe' }
      ];

      const sorted = sortBySurname(users);
      expect(sorted.map(u => u.name)).toEqual([
        'Adam Brown', // Brown
        'Jane Doe',   // Doe, Jane
        'john doe'    // Doe, john
      ]);
    });
  });
});
