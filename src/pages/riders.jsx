import { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import customFetch from "../utils/customFetch";
import { useGlobalContext } from "../utils/context";
import { useNavigate } from "react-router-dom";
import { SearchEntity } from "../components/searchEntity";
import {
  REVIEW_BADGE_CLASSES,
  REVIEW_FILTERS,
  REVIEW_STATUS_LABELS,
  apiErrorMessage,
  reviewStatusOf,
  ridersUrl,
} from "../utils/driverReview";

export const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [listError, setListError] = useState("");
  const { setGlobalLoading, setSearchTerm } = useGlobalContext();
  const navigate = useNavigate();

  async function fetchRiders(page = 1, limit = 10) {
    setGlobalLoading(true);
    try {
      const {
        data: { data, meta },
        status,
      } = await customFetch(ridersUrl({ page, limit, filter: reviewFilter }));

      if (status === 200) {
        setRiders(data);
        setPageCount(meta.pageCount);
        setListError("");
      }
    } catch (error) {
      // Never leave a previous filter's rows on screen under a different filter.
      setRiders([]);
      setListError(apiErrorMessage(error, "Could not load drivers."));
    } finally {
      setGlobalLoading(false);
    }
  }

  useEffect(() => {
    fetchRiders(currentPage);
  }, [currentPage, reviewFilter]);

  // Handle page click
  const handlePageClick = (event) => {
    const newPage = event.selected + 1;
    setCurrentPage(newPage);
  };

  return (
    <section className="px-4 pt-5">
      <h1>Drivers</h1>
      <div className=" flex flex-col md:flex-row gap-2 md:justify-between items-start md:items-center">
        <div className="searchEntityContainer flex gap-4  items-center">
          {/* search rider */}
          <div>
            <SearchEntity
              routeTitle={"riders"}
              placeholder={"Search rider"}
              pageLayout={true}
              updateDataFunction={setRiders}
            />
          </div>
          {/* clear search */}
          <button
            onClick={() => {
              setSearchTerm("");
              fetchRiders(currentPage);
            }}
            className=" border shadow-sm p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
          >
            Clear search
          </button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Driver application status filter">
          {REVIEW_FILTERS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setCurrentPage(1);
                setReviewFilter(value);
              }}
              aria-pressed={reviewFilter === value}
              className={`border shadow-sm px-3 py-1 rounded-md text-xs ${reviewFilter === value ? "bg-blue-100" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {listError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {listError}
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full border-collapse border text-center text-xs md:text-sm border-gray200 text-gray600 mt-3">
          <thead className="bg-gray50 font-medium">
            <tr>
              <th className="border border-gray200 p-3">First Name</th>
              <th className="border border-gray200 p-3">Last Name</th>
              <th className="border border-gray200 p-3">Phone Number</th>
              <th className="border border-gray200 p-3">Email</th>
              <th className="border border-gray200 p-3">Role</th>
              <th className="border border-gray200 p-3">Status</th>
              <th className="border border-gray200 p-3">Application</th>
              <th className="border border-gray200 p-3">Actions</th>
            </tr>
          </thead>
          {riders.length < 1 ? (
            <tbody>
              <tr>
                <td>
                  <p className=" p-2 w-full ">No drivers match this filter</p>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {riders.map(
                ({
                  phoneNumber,
                  firstName,
                  lastName,
                  email,
                  role,
                  id,
                  status,
                  driver,
                }) => {
                  const reviewStatus = reviewStatusOf(driver);
                  return (
                    <tr
                      key={id}
                      className="globalTransition hover:bg-gray100  bg-white"
                    >
                      <td className="border border-gray200 p-3">{firstName}</td>
                      <td className="border border-gray200 p-3">{lastName}</td>
                      <td className="border border-gray200 p-3">{phoneNumber}</td>
                      <td className="border border-gray200 p-3">{email}</td>
                      <td className="border border-gray200 p-3">{role}</td>
                      <td className="border border-gray200 p-3">{status}</td>
                      <td className="border border-gray200 p-3">
                        <span className={`px-2 py-1 rounded text-xs ${REVIEW_BADGE_CLASSES[reviewStatus]}`}>
                          {REVIEW_STATUS_LABELS[reviewStatus]}
                        </span>
                      </td>
                      <td className="border border-gray200 p-3 flex items-center justify-center">
                        <button
                          onClick={() => navigate(id)}
                          className="px-3 py-1 mr-2 border p-1 rounded-md hover:bg-blue-100 globalTransition text-xs"
                        >
                          {reviewStatus === "pending" ? "Review" : "View Driver"}
                        </button>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          )}
        </table>

        {/* Pagination */}
        <ReactPaginate
          breakLabel="..."
          nextLabel="next >"
          onPageChange={handlePageClick}
          pageRangeDisplayed={5}
          pageCount={pageCount}
          previousLabel="< previous"
          renderOnZeroPageCount={null}
          containerClassName="pagination"
          pageLinkClassName="page-num"
          previousLinkClassName="page-num"
          nextLinkClassName="page-num"
          activeLinkClassName="active"
        />
      </div>
    </section>
  );
};
