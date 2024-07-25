
const Deployer = require('aeproject-lib').Deployer;
const CONTRACT_PATH = "./contracts/RecheckRecords.aes";
const keccak256 = require('keccak256');

function getHash(string) {
    return `${keccak256(string).toString('hex')}`;
}

function getTrail(recordId, owner, receiver, action) {
    return getHash(recordId+owner+receiver+action);
}
describe('RecheckRecords Contract', () => {

    let deployer;
    let instance;
    let ownerKeyPair = wallets[0];
    let recordId = 'e559e608c40cabcb68b3d840ba275e060544f0ae31297a5966dcb07ce7b12310';

    before(async () => {
        deployer = new Deployer('testnet', ownerKeyPair.secretKey)
    })

    it('Deploying Contract', async () => {
        const deployedPromise = deployer.deploy(CONTRACT_PATH) // Deploy it

        await assert.isFulfilled(deployedPromise, 'Could not deploy the Smart Contract') // Check whether it's deployed
        instance = await Promise.resolve(deployedPromise)
    })

    it('Should check if a record has been created', async () => {
        let action = "upload"
        let trail = getTrail(recordId, ownerKeyPair.publicKey, ownerKeyPair.publicKey, action)
        await instance.createRecord(recordId, trail, trail)

        let exists = (await instance.getRecord(recordId)).decodedResult.recordId == recordId

        assert.isTrue(exists, 'Record with recordId = ' + recordId + ' has not been created')
    })

    it('Should check if a subrecord can be created', async () => {
        let action = "check";
        let childRecordId = getHash(recordId + '1')
        let trail = getTrail(childRecordId, ownerKeyPair.publicKey, ownerKeyPair.publicKey, action)

        await instance.createSubRecord(childRecordId, recordId, trail, trail)

        let childRecord = (await instance.getSubRecord(recordId, 0)).decodedResult
        let exists = childRecord.parentId == recordId
        assert.isTrue(exists, 'Child record with recordId = ' + childRecordId + ' has not been created')
    })

    it('Should check if a subrecord counting is correct', async () => {
        let action = "check";
        let childRecordId = getHash(recordId + '2')
        let trail = getTrail(childRecordId, ownerKeyPair.publicKey, ownerKeyPair.publicKey, action)

        await instance.createSubRecord(childRecordId, recordId, trail, trail)

        let childRecordCount = (await instance.countSubRecords(recordId)).decodedResult
        let correct1 = childRecordCount == 2
        let correct2 = (await instance.getRecord(recordId)).decodedResult.subRecords == childRecordCount

        assert.isTrue(correct1, 'Child record count for recordId = ' + childRecordId + ' is not correct')
        assert.isTrue(correct2, 'Child record count for recordId = ' + childRecordId + ' does not match resoved record count field')
    })

    it('Should check if a parent record can be resolved by trail', async () => {
        let action = "upload"
        let trail = getTrail(recordId, ownerKeyPair.publicKey, ownerKeyPair.publicKey, action)

        let resolved = (await instance.verifyTrail(trail)).decodedResult.recordId == recordId

        assert.isTrue(resolved, 'Record with trail = ' + trail + ' has not been resolved correctly')
    })

    it('Should check if a child record can be resolved by trail', async () => {
        let action = "check";
        let childRecordId = getHash(recordId + '2')
        let trail = getTrail(childRecordId, ownerKeyPair.publicKey, ownerKeyPair.publicKey, action)

        let decodedResult = (await instance.verifyTrail(trail)).decodedResult
        let resolved = decodedResult.parentId == recordId && decodedResult.recordId == childRecordId

        assert.isTrue(resolved, 'Record with trail = ' + trail + ' has not been resolved correctly')
    })

    it('Should check if duplicate record has been rejected', async () => {
        let action = "upload"
        let trail = getTrail(recordId, ownerKeyPair.publicKey, ownerKeyPair.publicKey, action)

        const createPromise = instance.createRecord(recordId, trail, trail)
        try {
            await assert.isRejected(createPromise, 'Invocation failed') 
            await Promise.reject(createPromise)    
        } catch (error) {}
    })
})