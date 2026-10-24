#ifndef CONFIG_H
#define CONFIG_H
#pragma once

#include <memory>
#include <string>
#include <vector>

#include <boost/filesystem.hpp>

#include "../generator/Generator.hpp"
#include "RuntimeOptions.hpp"

namespace fs = boost::filesystem;

class ConfigParser;

class Config : public RuntimeOptions {
  friend ConfigParser;

  using RuntimeOptions::RuntimeOptions;

private:
  string _version;
  vector<shared_ptr<Generator>> _generators;

public:
  Config(const RuntimeOptions &);
  Config(RuntimeOptions &&);
  const string &version() const;
  const vector<shared_ptr<Generator>> &generators() const;
};
#endif