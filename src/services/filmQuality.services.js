const { FilmQuality } = require("../model/filmQuality.model").filmQuality;

class FilmQualityService {
  //Create new filmQuality
  async createFilmQuality(filmQuality) {
    return await filmQuality.save();
  }

  async getFilmQualityById(filmQualityId) {
    return await FilmQuality.findById(filmQualityId);
  }

  async validateFilmQualityIds(filmQualityIds, isWindshield) {
    const filmQualities = await FilmQuality.find({
      _id: { $in: filmQualityIds },
      ...(isWindshield
        ? { isWindshield }
        : { type: "auto", isWindshield: undefined }),
    });

    const foundIds = filmQualities.map((d) => d._id.toString());

    const missingIds = filmQualityIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  findFilmQualitiesNotInArray(filmQualityIds, isWindshield) {
    return FilmQuality.find({
      _id: { $nin: filmQualityIds },
      ...(isWindshield
        ? { isWindshield }
        : { type: "auto", isWindshield: undefined }),
    });
  }

  async getFilmQualityByEntryIdAndStaffId(entryId, staffId) {
    return await FilmQuality.findOne({ entryId, staffId });
  }

  async getAllFilmQualities() {
    return await FilmQuality.find({ type: "auto" }).sort({ _id: -1 });
  }

  async getAllFilmQualitiesByType(type) {
    return FilmQuality.find({ type }).sort({ _id: -1 });
  }

  async updateFilmQualityById(id, filmQuality) {
    return await FilmQuality.findByIdAndUpdate(
      id,
      {
        $set: filmQuality,
      },
      { new: true }
    );
  }

  async deleteFilmQuality(id) {
    return await FilmQuality.findByIdAndRemove(id);
  }
}

module.exports = new FilmQualityService();
