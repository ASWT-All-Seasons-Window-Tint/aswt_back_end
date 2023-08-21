const { Entry } = require("../model/entry.model");

class EntryService {
  //Create new entry
  async createEntry(entry) {
    return await entry.save();
  }

  async getEntryById(entryId) {
    return await Entry.findById(entryId);
  }

  async validateEntryIds(entryIds) {
    const entrys = await Entry.find({
      _id: { $in: entryIds },
    });

    const foundIds = entrys.map((d) => d._id.toString());

    const missingIds = entryIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getEntryByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Entry.findOne({ name: caseInsensitiveName });
  }

  async getAllEntrys() {
    return await Entry.find().sort({ _id: -1 });
  }

  async updateEntryById(id, entry) {
    return await Entry.findByIdAndUpdate(
      id,
      {
        $set: entry,
      },
      { new: true }
    );
  }

  async deleteEntry(id) {
    return await Entry.findByIdAndRemove(id);
  }
}

module.exports = new EntryService();
