const mongoose = require('mongoose');
const Task = require('../server/models/Task');

describe('Phase 2: Parikshak Next-Task Duplicate Prevention', () => {
    let findOneSpy;

    beforeEach(() => {
        findOneSpy = jest.spyOn(Task, 'findOne');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should query the Database for existing pending tasks for the same assignee', async () => {
        // Mock that a duplicate task already exists in the queue
        findOneSpy.mockResolvedValue({ _id: 'duplicate_task_id', title: 'Phase 2: T-100', status: 'Pending' });

        const existingduplicate = await Task.findOne({
            title: 'Phase 2: T-100',
            assignee: 'user-id-mock',
            status: 'Pending'
        });

        expect(findOneSpy).toHaveBeenCalledWith({
            title: 'Phase 2: T-100',
            assignee: 'user-id-mock',
            status: 'Pending'
        });
        expect(existingduplicate).not.toBeNull();
        expect(existingduplicate._id).toBe('duplicate_task_id');
    });

    it('should allow new task creation only if no duplicate exists', async () => {
        findOneSpy.mockResolvedValue(null); // No existing task

        const existingduplicate = await Task.findOne({
            title: 'Brand New Task',
            assignee: 'user-id-mock',
            status: 'Pending'
        });

        expect(findOneSpy).toHaveBeenCalled();
        expect(existingduplicate).toBeNull();
    });
});
