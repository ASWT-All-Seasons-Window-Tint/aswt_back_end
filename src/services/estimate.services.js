const { getOrSetCache } = require("../utils/getOrSetCache.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");

class EstimateService {
  createEstimateOnQuickBooks(qbo, estimateData) {
    return new Promise((resolve, reject) => {
      const results = {};
      qbo.createEstimate(estimateData, (err, estimate) => {
        if (err) {
          reject(err);
        } else {
          results.estimate = estimate;

          resolve(results);
        }
      });
    });
  }

  async updateEstimateById(qbo, Id, estimate, SyncToken) {
    return new Promise((resolve, reject) => {
      qbo.updateEstimate(
        {
          Id,
          SyncToken,
          sparse: true,
          ...estimate,
        },
        (err, estimate) => {
          if (err) {
            reject(err);
          } else {
            resolve(estimate);
          }
        }
      );
    });
  }

  async getEstimateById(qbo, estimateId) {
    // Initialize the QuickBooks SDK
    return new Promise((resolve, reject) => {
      qbo.getEstimate(estimateId, (err, estimate) => {
        if (err) {
          reject(err);
        } else {
          resolve(estimate);
        }
      });
    });
  }

  getOrSetEstimateOnCache = async (id, qbo) => {
    const expires = 1800;

    const results = await getOrSetCache(
      `estimates?Id=${id}`,
      expires,
      this.getEstimateById,
      [qbo, id]
    );

    return results;
  };

  sendEstimatePdf(qbo, estimateId, emailAddr) {
    return new Promise((resolve, reject) => {
      qbo.sendEstimatePdf(estimateId, emailAddr, (sendErr, sendResponse) => {
        if (sendErr) {
          console.log(sendErr.Fault.Error[0]);
          reject("Error sending estimate:", sendErr);
        } else {
          resolve(sendResponse);
        }
      });
    });
  }
}
module.exports = new EstimateService();
