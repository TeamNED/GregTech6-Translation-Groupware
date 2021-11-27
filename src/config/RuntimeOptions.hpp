#ifndef RUNTIMEOPTIONS_H
#define RUNTIMEOPTIONS_H
#pragma once

#include <string>
#include <vector>

#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>

using std::string;
using std::vector;
namespace fs = boost::filesystem;
namespace po = boost::program_options;

class RuntimeOptions {
protected:
  fs::path _main_source_path, _extra_source_path, _main_target_path,
      _extra_target_path, _config_path, _workplace_path;
  string _lang;
  vector<string> _extensions;

public:
  RuntimeOptions(int argc, char const *argv[]);
  RuntimeOptions(const RuntimeOptions &) = default;
  RuntimeOptions(RuntimeOptions &&) = default;
  RuntimeOptions &operator=(const RuntimeOptions &) = default;
  RuntimeOptions &operator=(RuntimeOptions &&) = default;
  virtual const fs::path &main_source_path() const;
  virtual const fs::path &extra_source_path() const;
  virtual const fs::path &main_target_path() const;
  virtual const fs::path &extra_target_path() const;
  virtual const fs::path &config_path() const;
  virtual const fs::path &workplace_path() const;
  virtual const string &lang() const;
  virtual const vector<string> &extensions() const;
  virtual ~RuntimeOptions() = default;
};
#endif