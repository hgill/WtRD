Window to Remote Datasource 
  - a middle layer between a data source and frontend - a disposable alternative for pagination

This library handles the boilerplate of 
 - left and right data scrolls using only .next() and .previous() functions
 - scaling buffer and demands according to scaled dataset (start with 10 wide and go to 100 wide)
 - in-browser buffer of data for infinite-scroll-like functionality
 - demanding only data not already available
 - handling edge cases - start of data/end of data

Use cases: 
 - Quickly changing underlying datasource without changing mid and front(e.g. searches)
 - Same data, multiple representations(e.g. one WtRD for view finder, one for a chart) 
